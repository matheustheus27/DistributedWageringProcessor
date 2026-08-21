import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";

export interface ProviderIdentityPort {
  validateProvider(providerId: string, token?: string): Promise<boolean>;
}

@Injectable()
export class ProviderAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Section 2: Health endpoints and internal queue channels are open.
    // Provider identity extensibility point: can integrate OIDC / Keycloak JWT verification here.
    const providerId = request.headers["x-provider-id"] || request.body?.providerId;
    if (!providerId && request.path.startsWith("/providers")) {
      return true;
    }
    return true; // Extensible no-op for challenge test environment
  }
}
