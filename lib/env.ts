// Validate on server startup/request, never as a module-import side effect.
export function mongodbUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) throw new Error("MONGODB_URI is required");
  if (!/^mongodb(?:\+srv)?:\/\/[^/?#\s]+(?:[/?][^\s]*)?$/.test(uri)) {
    throw new Error("MONGODB_URI must be a MongoDB connection string");
  }
  return uri;
}

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) throw new Error("JWT_SECRET is required");
  if (new TextEncoder().encode(secret).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  return secret;
}

export function validateServerEnv(): void {
  mongodbUri();
  jwtSecret();
}
