import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { appConfiguration, AppConfiguration } from './config/';

const globalPrefix = '/api';
const configureSwagger = (app: INestApplication) => {
  const appConfig = app.get<AppConfiguration>(appConfiguration.KEY);
  const baseApis = `/${appConfig.baseUrl}${globalPrefix}`;
  const baseUrl = baseApis.replace('//', '/');
  const swaggerDocOptions = new DocumentBuilder()
    .setTitle('Sui-MM')
    .setDescription('The account-service API description')
    .setVersion('1.0.0')
    .addServer(baseUrl)
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-KEY' }, 'x-api-key')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerDocOptions, {
    ignoreGlobalPrefix: true,
  });
  SwaggerModule.setup('docs', app, swaggerDoc);
};

const configureValidation = (app: INestApplication) => {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
    }),
  );
};

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get<AppConfiguration>(appConfiguration.KEY);
  app.setGlobalPrefix(globalPrefix);
  configureSwagger(app);
  configureValidation(app);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Access-Token',
      'X-Refresh-Token',
      'x-api-key',
    ],
    credentials: true,
  });
  const server = await app.listen(appConfig.port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  server.setTimeout(19000);
};
bootstrap();
