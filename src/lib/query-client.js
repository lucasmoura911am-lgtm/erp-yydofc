import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnMount: true,
			staleTime: 30000, // 30s — dados ficam frescos por 30s
			retry: 1,
		},
	},
});