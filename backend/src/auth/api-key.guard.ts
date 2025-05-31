import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredApiKey = this.reflector.get<boolean>(
      'requiredApiKey',
      context.getHandler(),
    );
    if (!requiredApiKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.X_API_KEY) {
      // TODO return false later
      return false;
    }

    return true;
  }
}
