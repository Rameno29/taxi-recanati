import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import * as ExpoLocation from "expo-location";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import type { Driver, Ride } from "../types";
import { useAuth } from "./AuthContext";

interface DriverState {
  driver: Driver | null;
  isOnline: boolean;
  activeRide: Ride | null;
  incomingRequest: Ride | null;
  toggleOnline: () => Promise<void>;
  acceptRide: (rideId: string) => Promise<void>;
  declineRide: () => void;
  updateRideStatus: (status: string, reason?: string) => Promise<void>;
  refreshActiveRide: () => Promise<void>;
}

const DriverContext = createContext<DriverState | null>(null);

const GPS_INTERVAL = 5000; // 5 seconds

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<Ride | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch driver profile on mount
  useEffect(() => {
    if (user) {
      fetchDriverProfile();
      fetchActiveRide();
    }
  }, [user]);

  // Listen for incoming ride requests and status changes via Socket.io
  useEffect(() => {
    const tryListen = () => {
      const socket = getSocket();
      if (!socket) return null;

      const handleRideRequest = (data: any) => {
        // Server sends ride data directly or wrapped in { ride }
        const ride = data.ride || data;
        setIncomingRequest(ride as Ride);
      };

      const handleStatusChange = (data: any) => {
        const rideId = data.ride_id || data.rideId;
        const newStatus = data.new_status || data.newStatus;
        if (activeRide && rideId === activeRide.id && newStatus) {
          if (["completed", "cancelled", "no_show"].includes(newStatus)) {
            setActiveRide(null);
          } else {
            setActiveRide((prev) =>
              prev ? { ...prev, status: newStatus as any } : null
            );
          }
        }
        // If we had no active ride but got a status update, re-fetch
        if (!activeRide && newStatus === "accepted") {
          fetchActiveRide();
        }
      };

      // Listen for admin forcing driver status change (online/offline)
      const handleDriverStatus = (data: any) => {
        const newStatus = data.status;
        if (newStatus) {
          setIsOnline(newStatus !== "offline");
          setDriver((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      };

      socket.on("ride:request", handleRideRequest);
      socket.on("ride:status", handleStatusChange);
      socket.on("driver:status", handleDriverStatus);

      return () => {
        socket.off("ride:request", handleRideRequest);
        socket.off("ride:status", handleStatusChange);
        socket.off("driver:status", handleDriverStatus);
      };
    };

    const cleanup = tryListen();
    if (cleanup) return cleanup;

    // Retry if socket wasn't ready
    const retryInterval = setInterval(() => {
      const c = tryListen();
      if (c) clearInterval(retryInterval);
    }, 2000);

    return () => clearInterval(retryInterval);
  }, [activeRide?.id]);

  const fetchDriverProfile = async () => {
    try {
      const res = await api.get("/api/drivers/me");
      if (res.ok) {
        const data = await res.json();
        setDriver(data);
        setIsOnline(data.status !== "offline");
      }
    } catch {
      // Not yet registered as driver
    }
  };

  const fetchActiveRide = async () => {
    try {
      const res = await api.get("/api/rides/active");
      if (res.ok) {
        const data = await res.json();
        setActiveRide(data);
      }
    } catch {
      // No active ride
    }
  };

  // GPS tracking — push location to server every 5s while online
  const startGpsTracking = useCallback(async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    gpsIntervalRef.current = setInterval(async () => {
      try {
        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        const socket = getSocket();
        if (socket) {
          socket.emit("driver:location", {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
        // Also push to REST for persistence
        await api.post("/api/drivers/location", {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch {
        // GPS or network error — skip this tick
      }
    }, GPS_INTERVAL);
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
  }, []);

  // Start/stop GPS when online status changes
  useEffect(() => {
    if (isOnline) {
      startGpsTracking();
    } else {
      stopGpsTracking();
    }
    return stopGpsTracking;
  }, [isOnline]);

  const toggleOnline = async () => {
    const newStatus = isOnline ? "offline" : "available";
    const res = await api.patch("/api/drivers/status", { status: newStatus });
    if (res.ok) {
      setIsOnline(!isOnline);
      setDriver((prev) => (prev ? { ...prev, status: newStatus } : null));
    } else {
      const err = await res.json();
      throw new Error(err.message || "Failed to update status");
    }
  };

  const acceptRide = async (rideId: string) => {
    const res = await api.patch(`/api/rides/${rideId}/status`, {
      status: "accepted",
    });
    if (res.ok) {
      const ride = await res.json();
      setActiveRide(ride);
      setIncomingRequest(null);
    } else {
      const err = await res.json();
      throw new Error(err.message || "Failed to accept ride");
    }
  };

  const declineRide = () => {
    setIncomingRequest(null);
  };

  const updateRideStatus = async (status: string, reason?: string) => {
    if (!activeRide) return;
    const body: any = { status };
    if (reason) body.cancellation_reason = reason;

    const res = await api.patch(`/api/rides/${activeRide.id}/status`, body);
    if (res.ok) {
      const updatedRide = await res.json();
      if (["completed", "cancelled", "no_show"].includes(status)) {
        setActiveRide(null);
      } else {
        setActiveRide(updatedRide);
      }
    } else {
      const err = await res.json();
      throw new Error(err.message || "Failed to update ride status");
    }
  };

  const refreshActiveRide = async () => {
    await fetchActiveRide();
  };

  return (
    <DriverContext.Provider
      value={{
        driver,
        isOnline,
        activeRide,
        incomingRequest,
        toggleOnline,
        acceptRide,
        declineRide,
        updateRideStatus,
        refreshActiveRide,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error("useDriver must be used within DriverProvider");
  return ctx;
}
