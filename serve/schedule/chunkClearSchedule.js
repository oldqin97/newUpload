const fse = require('fs-extra');
const path = require('path');
const schedule = require('node-schedule');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

// 空目录删除
const removeVacantDir = (file, stats) => {
  const now = new Date().getTime();
  const offset = now - stats.ctimeMs;

  if (offset > 60000) {
    fse.unlinkSync(file);
    console.log(file, '文件过期,删除结束');
  }
};

const scan = async (dir, cb) => {
  const files = fse.readdirSync(dir);
  files.forEach(filename => {
    const fileDir = path.resolve(dir, filename);
    const stats = fse.statSync(fileDir);
    if (stats.isDirectory()) {
      // delete file
      scan(fileDir, removeVacantDir);
      // delete vacant dir
      if (fse.readdirSync(fileDir).length === 0) {
        fse.rmdirSync(fileDir);
      }
      return;
    }
    if (cb) {
      cb(fileDir, stats);
    }
  });
};

let start = () => {
  schedule.scheduleJob('*/5 * * * * *', () => {
    console.log('定时清理');
    scan(UPLOAD_DIR);
  });
};

start();
