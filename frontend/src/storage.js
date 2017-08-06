const { isFile } = require('./utils');

class Storage {
  constructor(engine) {
    this.engine = engine;
  }

  get totalDownloads() {
    return Number(this.engine.getItem('totalDownloads'));
  }
  set totalDownloads(n) {
    this.engine.setItem('totalDownloads', n);
  }
  get totalUploads() {
    return Number(this.engine.getItem('totalUploads'));
  }
  set totalUploads(n) {
    this.engine.setItem('totalUploads', n);
  }
  get referrer() {
    return this.engine.getItem('referrer');
  }
  set referrer(str) {
    this.engine.setItem('referrer', str);
  }

  get files() {
    const fs = [];
    for (let i = 0; i < this.engine.length; i++) {
      const k = this.engine.key(i);
      if (isFile(k)) {
        try {
          fs.push(JSON.parse(this.engine.getItem(k)));
        } catch (err) {
          // obviously you're not a golfer
          this.engine.removeItem(k);
        }
      }
    }
    return fs.sort((file1, file2) => {
      const creationDate1 = new Date(file1.creationDate);
      const creationDate2 = new Date(file2.creationDate);
      return creationDate1 - creationDate2;
    });
  }

  get numFiles() {
    let length = 0;
    for (let i = 0; i < this.engine.length; i++) {
      const k = this.engine.key(i);
      if (isFile(k)) {
        length += 1;
      }
    }
    return length;
  }

  getFileById(id) {
    return this.engine.getItem(id);
  }

  has(property) {
    return this.engine.hasOwnProperty(property);
  }

  remove(property) {
    this.engine.removeItem(property);
  }

  addFile(id, file) {
    this.engine.setItem(id, JSON.stringify(file));
  }
}

module.exports = Storage;
