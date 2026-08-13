export class TurnstileVerifier {
  async verifyToken(token: string, ip?: string): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    // Fail closed if the secret key is not configured in the environment
    if (!secretKey) {
      console.error('Turnstile verification error: TURNSTILE_SECRET_KEY environment variable is not defined.');
      return false;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as { success: boolean };
      return Boolean(result.success);
    } catch (error) {
      console.error('Turnstile network verification failed:', error);
      return false; // Fail closed on exceptions
    }
  }
}

export const turnstileVerifier = new TurnstileVerifier();
