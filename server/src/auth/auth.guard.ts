import { CanActivate,ExecutionContext,Inject,Injectable,UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request } from 'express';
import type { Actor } from '../database/database.service';
import {companionRoute} from './companion-policy';
export type AuthRequest=Request & {actor:Actor};
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(@Inject(AuthService) private readonly auth:AuthService){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<AuthRequest>();const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new UnauthorizedException('Sign in to continue.');req.actor=await this.auth.authenticate(token,req.headers['x-counter-session'] as string|undefined);companionRoute(req.actor,req);return true;}
}
