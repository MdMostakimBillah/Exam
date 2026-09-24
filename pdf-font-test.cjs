const { jsPDF } = require('jspdf');
const fs = require('fs');
const b64 = fs.readFileSync('./public/fonts/NotoSansBengali-Regular.ttf').toString('base64');

function build(registerDoc, out) {
  const doc = new jsPDF();
  if (registerDoc) { doc.addFileToVFS('n.ttf', b64); doc.addFont('n.ttf', 'NotoSans', 'normal'); }
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(18);
  const lines = ['বাংলা স্বাগতম', 'ক্ষমতা নিয়ে কাজ করি', 'কিছু ছাত্রীর নাম', 'রূপালী ব্যাংক পরীক্ষা'];
  lines.forEach((s, i) => doc.text(s, 10, 25 + i * 22));
  doc.setFont('NotoSans', 'bold');
  doc.text('BOLD বাংলা স্বাগতম', 10, 130);
  fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
}
build(true,  './font-test-1.pdf');   // font registered on THIS doc (first call)
build(false, './font-test-2.pdf');   // simulates loadFont() early-return (2nd call)
console.log('written');
