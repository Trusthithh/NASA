import React, { createContext, useContext, useMemo, useState } from "react";
import { SelectedLocation } from "../utils/geo";

interface LocationContextValue {
  location: SelectedLocation | null;
  setLocation: (location: SelectedLocation | null) => void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const value = useMemo(() => ({ location, setLocation }), [location]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export function useSelectedLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useSelectedLocation must be used inside <LocationProvider>");
  return ctx;
}
