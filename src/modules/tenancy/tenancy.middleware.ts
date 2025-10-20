import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ 
        statusCode: 400,
        message: 'Tenant ID is missing in x-tenant-id header' 
      });
    }

    req['tenantId'] = tenantId;
    next();
  }
}
