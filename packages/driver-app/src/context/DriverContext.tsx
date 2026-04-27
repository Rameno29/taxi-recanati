import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import * as ExpoLocation from "expo-location";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import type { Driver, Ride } from "../types";
import { useAuth } from "./AuthContext";
import { alertRideRequest, hapticSuccess } from "../services/feedback";

interface DriverState {
  driver: Driver | null;
  isOnline: boolean;
  activeRide: Ride | null;
  /** First-come-first-served queue of rides currently up for grabs. */
  availableRides: Ride[];
  /** Convenience: same as `availableRides[0]` — legacy single-request UI. */
  incomingRequest: Ride | null;
  toggleOnline: () => Promise<void>;
  acceptRide: (rideId: string) => Promise<void>;
  declineRide: (rideId?: string) => void;
  /** Force-refresh the available ride list from the server. */
  refreshAvailableRides: () => Promise<void>;
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
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI convenience: treat the oldest queued ride as the "primary" incoming
  // request so the existing single-card UI keeps working.
  const incomingRequest = availableRides[0] || null;

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
        const ride = (data.ride || data) as Ride;
        // Dedup — ignore if already queued or already the active ride
        setAvailableRides((prev) => {
          if (prev.some((r) => r.id === ride.id)) return prev;
          return [...prev, ride];
        });
        // Sound + vibration alert only for the first new arrival
        alertRideRequest();
      };

      // Broadcast dispatch: a new ride is up for grabs for ALL online drivers
      const handleRideAvailable = (data: any) => {
        const ride = (data.ride || data) as Ride;
        setAvailableRides((prev) => {
          if (prev.some((r) => r.id === ride.id)) return prev;
          return [...prev, ride];
        });
        alertRideRequest();
      };

      // Another driver accepted / it got cancelled — drop it from the list
      const handleRideUnavailable = (data: any) => {
        const rideId = data.ride_id || data.rideId;
        if (!rideId) return;
        setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
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
      socket.on("ride:available", handleRideAvailable);
      socket.on("ride:unavailable", handleRideUnavailable);
      socket.on("ride:status", handleStatusChange);
      socket.on("driver:status", handleDriverStatus);

      return () => {
        socket.off("ride:request", handleRideRequest);
        socket.off("ride:available", handleRideAvailable);
        socket.off("ride:unavailable", handleRideUnavailable);
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

  const fetchAvailableRides = useCallback(async () => {
    try {
      const res = await api.get("/api/rides/available");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAvailableRides(data as Ride[]);
      }
    } catch {
      // Network error — keep whatever is already in the list
    }
  }, []);

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

  // Whenever we (re)enter online state — including on app launch when the
  // driver was already online from a previous session — refresh the list
  // of available rides. This is also the recovery path if sockets lag.
  useEffect(() => {
    if (isOnline) fetchAvailableRides();
  }, [isOnline, fetchAvailableRides]);

  const toggleOnline = async () => {
    const newStatus = isOnline ? "offline" : "available";
    const res = await api.patch("/api/drivers/status", { status: newStatus });
    if (res.ok) {
      const goingOnline = !isOnline;
      setIsOnline(goingOnline);
      setDriver((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (goingOnline) {
        // Populate the feed with rides already pending before we went online
        fetchAvailableRides();
      } else {
        // Drop the local queue — we shouldn't see anything while offline
        setAvailableRides([]);
      }
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
      // Clear the whole queue — we're on a ride now, nothing else is relevant.
      // Other drivers will be told via ride:unavailable. If our acceptance
      // raced with another driver and we lost, the ride won't be returned as
      // status=accepted; the catch below handles that.
      setAvailableRides([]);
      hapticSuccess();
    } else {
      const err = await res.json().catch(() => ({ message: "" }));
      // Conflict = someone else accepted first. Remove it from our list and
      // show a friendly message to the user.
      if (res.status === 400 || res.status === 409) {
        setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
      }
      throw new Error(err.message || "Failed to accept ride");
    }
  };

  const declineRide = (rideId?: string) => {
    // Local-only — drop it from our list. Other drivers still see it.
    const targetId = rideId || availableRides[0]?.id;
    if (!targetId) return;
    setAvailableRides((prev) => prev.filter((r) => r.id !== targetId));
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
        availableRides,
        incomingRequest,
        toggleOnline,
        acceptRide,
        declineRide,
        refreshAvailableRides: fetchAvailableRides,
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
