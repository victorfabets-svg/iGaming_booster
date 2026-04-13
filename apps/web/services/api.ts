// Placeholder API client - real implementation in services/
const createApiClient = (baseUrl: string) => {
  return {
    getHealth: async () => null,

    submitProof: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("user_id", "test-user")

      const response = await fetch("/proofs", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      return response
    },
  }
}

export default createApiClient