import {ArgumentsHost,Catch,ExceptionFilter,HttpException,Logger} from '@nestjs/common';
@Catch()
export class SafeErrors implements ExceptionFilter{
 private readonly logger=new Logger('API');
 catch(error:unknown,host:ArgumentsHost){
  const res=host.switchToHttp().getResponse();let status=500,message='Something went wrong. Try again.',code='INTERNAL';
  if(error instanceof HttpException){status=error.getStatus();const body=error.getResponse();message=typeof body==='string'?body:String((body as {message?:unknown}).message??error.message);code='HTTP_'+status;}
  else if(error&&typeof error==='object'&&'code' in error){const pg=error as {code:string,message?:string};code=pg.code;
   if(code==='42501'){status=403;message='You do not have permission for this action.';}
   else if(['57P01','57P02','57P03','53300','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH'].includes(code)||code.startsWith('08')){status=503;message='The shop server is temporarily unavailable. Try again.';}
   else if(['23505','40001','40P01'].includes(code)){status=409;message=code==='23505'?'This record already exists.':'The record changed. Refresh and try again.';}
   else if(['22023','P0001'].includes(code)){status=422;message=pg.message?.split('\n')[0].slice(0,240)??'Check the entered values.';}
   else if(code.startsWith('22')||code.startsWith('23')){status=422;message='Check the entered values and record references.';}
  }
  if(status===500)this.logger.error('Request failed with internal error code '+code);
  res.status(status).json({statusCode:status,message,code});
 }
}
