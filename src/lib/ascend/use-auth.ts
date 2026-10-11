import { getLocalUser } from "./identity";

/** The app runs locally on this device, so there is always a "current user". */
export function useAuthUser() {
  return { user: getLocalUser(), loading: false };
}
