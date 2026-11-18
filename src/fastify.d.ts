import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Raw request body string, captured for HMAC signature verification. */
    rawBody?: string;
  }
}
