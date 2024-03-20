import fs from 'fs';

export function writeJsonFile(filePath: string, data: string) {
  fs.writeFile(filePath, data, 'utf-8', err => {
    if (err) {
      console.error('Error writing to file:', err);
    }
  });
}
