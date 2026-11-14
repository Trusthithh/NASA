from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str = ""
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal"
    nasa_timeout_seconds: float = 45.0
    gemini_api_key: str = ""
    ai_model_name: str = "gemini-2.5-flash"
    cache_ttl_seconds: int = 3600

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
