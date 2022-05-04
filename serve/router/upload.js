const router = require('koa-router')();
const path = require('path');
const fse = require('fs-extra');

// 提取文件后缀名
const extractExt = filename =>
  filename.slice(filename.lastIndexOf('.'), filename.length);

// 文件存储目录
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

// 返回已经上传切片列表
const createUploadedList = async fileHash => {
  return fse.existsSync(
    path.resolve(UPLOAD_DIR, `${fileHash}-chunks`),
  )
    ? await fse.readdir(
        path.resolve(UPLOAD_DIR, `${fileHash}-chunks`),
      )
    : [];
};

// 按路径 创建readStream 写入 writeStream
const pipeStream = (path, writeStream) => {
  return new Promise(resolve => {
    const readStream = fse.createReadStream(path);

    readStream.on('end', () => {
      resolve();
    });

    readStream.pipe(writeStream);
  });
};

// 读取所有chunk 合并到filePath中
const mergeFileChunk = async (filePath, chunkDir, size) => {
  // 读取chunk列表
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);

  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置创建可写流
        fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size,
        }),
      );
    }),
  );

  // fse.rmdirSync(chunkDir) // 合并后删除保存切片的目录
};

// 上传
router.post('/upload-chunk', async ctx => {
  // request params

  // hash是当前chunk的唯一值 fileHash是文件的hash
  const { chunkHash, fileHash } = ctx.request.body;
  // hash文件
  const { chunk } = ctx.request.files;
  // chunk文件保存的路径
  const chunkDir = path.resolve(UPLOAD_DIR, `${fileHash}-chunks`);
  // 目录是否存在,不存在创建切片保存目录
  if (!fse.existsSync(chunkDir)) {
    await fse.mkdir(chunkDir);
  }

  // 移动文件
  await fse.move(chunk.path, `${chunkDir}/${chunkHash}`);
  ctx.body = { code: 0, data: '', msg: '上传成功' };
});

// 合并
router.post('/merge', async ctx => {
  const { filename, fileSize, size, hash } = ctx.request.body;
  // filePath 文件存储路径
  const ext = extractExt(filename);
  const filePath = path.resolve(UPLOAD_DIR, `${hash}${ext}`);
  const chunkDir = path.resolve(UPLOAD_DIR, `${hash}-chunks`);
  await mergeFileChunk(filePath, chunkDir, size);
  ctx.body = { code: 0, data: '', msg: 'success' };
});

// 验证是否存在文件
router.post('/verify', async ctx => {
  const { filename, fileHash } = ctx.request.body;
  let shouldUpload = true;
  let message = '文件不存在, 需要上传';

  const ext = extractExt(filename);
  const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
  if (fse.existsSync(filePath)) {
    shouldUpload = false;
    message = '文件存在, 不需要上传';
  }
  ctx.body = {
    code: 0,
    data: {
      shouldUpload,
      uploadedList: await createUploadedList(fileHash),
    },
    message,
  };
});

router.get('/test', ctx => {
  ctx.body = {
    code: 1,
    msg: 'success',
  };
});

module.exports = router;
