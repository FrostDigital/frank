let configCache: RuntimeConfig | null = null

export interface RuntimeConfig {
    FOLDER_DELETE_MODE: "DETACH" | "CASCADE" | "PROMPT"
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
    if (configCache) {
        return configCache
    }

    try {
        const response = await fetch("/api/runtime-config", {
            cache: "no-store",
        })
        const config = await response.json()
        configCache = config
        return config
    } catch (error) {
        console.error("Failed to load runtime config:", error)
        // Return defaults if config fetch fails
        return {
            FOLDER_DELETE_MODE: "DETACH",
        }
    }
}
