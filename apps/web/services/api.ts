// Placeholder API client - real implementation in services/
const createApiClient = (baseUrl: string) => {
  return {
    getHealth: async () => {
      // Placeholder - real implementation would make actual API call
      return null;
    },
    submitProof: async (_file: File) => {
      // Placeholder - real implementation would make actual API call
      return null;
    },
  };
};

export default createApiClient;