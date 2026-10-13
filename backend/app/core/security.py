
from pwdlib import PasswordHash

# Configure the recommended password-hashing algorithm.
# With the Argon2 extra installed, this selects Argon2id.
password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plaintext password before storing it."""
    if not password:
        raise ValueError("Password cannot be empty")

    return password_hasher.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Check a plaintext password against its stored hash."""
    if not plain_password or not hashed_password:
        return False

    try:
        return password_hasher.verify(
            plain_password,
            hashed_password,
        )
    except (ValueError, TypeError):
        return False
