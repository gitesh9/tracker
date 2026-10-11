import { useQuery } from "@tanstack/react-query";
import { cachedAccount, fetchAuthStatus, type Account } from "./account";

/**
 * The signed-in account (not the local device identity).
 *
 * Squads need a real account so invites and shared boards can reach other
 * people. Offline we trust the cached account so a signed-in user keeps
 * working; online we refresh it from the server.
 */
export function useAccount() {
  return useQuery({
    queryKey: ["account"] as const,
    initialData: () => cachedAccount(),
    queryFn: async (): Promise<Account | null> => {
      try {
        const status = await fetchAuthStatus();
        return status.user;
      } catch {
        // Offline or unreachable — keep whatever we last knew.
        return cachedAccount();
      }
    },
    staleTime: 30_000,
  });
}
