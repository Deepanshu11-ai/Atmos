
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    neon_database_url: str

    session_cookie_name: str = "atomos_session"
    session_ttl_hours: int = 12

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    session_cookie_secure: bool = False

    @property
    def database_url(self) -> str:
        return self.neon_database_url


settings = Settings()
