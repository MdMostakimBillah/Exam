const { jsPDF } = require('jspdf');
const mod = require('jspdf-autotable');
const autoTable = mod.default || mod;
const fs = require('fs');
const b64 = fs.readFileSync('./public/fonts/kalpurush.ttf').toString('base64');
function build(out) {
  const doc = new jsPDF();
  doc.addFileToVFS('kalpurush.ttf', b64);
  doc.addFont('kalpurush.ttf', 'Kalpurush', 'normal');
  doc.addFont('kalpurush.ttf', 'Kalpurush', 'bold');
  const F = 'Kalpurush';
  doc.setFont(F, 'bold'); doc.setFontSize(14);
  doc.text('শিক্ষার্থী তালিকা', 105, 20, { align: 'center' });
  autoTable(doc, {
    startY: 30,
    head: [['#', 'নাম', 'পিতার নাম', 'মাতার নাম', 'ফোন', 'শ্রেণী']],
    body: [['1', 'মোঃ আব্দুল্লাহ আল মামুন', 'রহিম উদ্দিন', 'আমেনা বেগম', '01712345678', '৫ম'],
           ['2', 'সাদিয়া আক্তার', 'করিম মিয়া', 'ফাতেমা খাতুন', '01911223344', '১০ম']],
    theme: 'grid',
    styles: { font: F, fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [147, 51, 234], fontStyle: 'bold', halign: 'center' },
  });
  fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
}
build('./font-test-1.pdf'); build('./font-test-2.pdf');
console.log('ok');
