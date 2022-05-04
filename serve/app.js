const Koa = require('koa');
const app = new Koa();

const json = require('koa-json');
const onerror = require('koa-onerror');
const logger = require('koa-logger');
const koaBody = require('koa-body');

const upload = require('./router/upload');
require('./schedule/chunkClearSchedule')

// error handler
onerror(app);

app.use(json());
app.use(logger());
app.use(require('koa-static')(__dirname + '/public'));

// koa-body
app.use(
  koaBody({
    multipart: true,
    formidable: { maxFileSize: 200 * 1024 * 1024 },
  }),
);

// logger
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

app.use(async (ctx, next) => {
  ctx.set('Access-Control-Allow-Origin', '*');
  ctx.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild',
  );
  if (ctx.method === 'OPTIONS') {
    ctx.status = 200;
  } else {
    await next();
  }
});

app.use(upload.routes(), upload.allowedMethods());

app.on('error', (err, ctx) => {
  console.error('serve error', err, ctx);
});

module.exports = app
