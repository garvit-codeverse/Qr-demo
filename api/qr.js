const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  
  const { text, size = 350, margin = 2, dark, light } = req.query;
  if (!text) return res.status(400).send('Missing "text" parameter');

  const darkColor = dark || '#000000';
  const lightColor = light || '#ffffff';

  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      margin: parseInt(margin),
      width: parseInt(size),
      color: { dark: darkColor, light: lightColor },
    });

    let finalBuffer = qrBuffer;

    // Logo optional hai - agar file nahi milegi toh sirf QR generate hoga
    const logoPath = path.resolve(process.cwd(), 'FamPay.png');
    if (fs.existsSync(logoPath)) {
      try {
        const logoSize = Math.floor(parseInt(size) * 0.22);
        const logoBufferResized = await sharp(logoPath).resize(logoSize, logoSize).toBuffer();

        const circleSvg = Buffer.from(`
          <svg width="${logoSize}" height="${logoSize}">
            <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="white"/>
          </svg>
        `);

        const circularLogoBuffer = await sharp(logoBufferResized)
          .composite([{ input: circleSvg, blend: 'dest-in' }])
          .png()
          .toBuffer();

        finalBuffer = await sharp(qrBuffer)
          .composite([{ input: circularLogoBuffer, gravity: 'centre' }])
          .png()
          .toBuffer();
      } catch (logoErr) {
        console.log("Logo skip kar diya, sirf QR generate ho raha hai");
      }
    }

    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(finalBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
