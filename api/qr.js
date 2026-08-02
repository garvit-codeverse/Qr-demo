const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// =============================================
// 🎨 PRE-BUILT STYLES (Pro Level Themes)
// =============================================
const STYLES = {
  // 1. Dark Mode (Black Background, White Dots)
  dark: { dark: '#FFFFFF', light: '#0F172A' },
  
  // 2. Neon Pop (Pink Dots, Black BG)
  neon: { dark: '#FF007F', light: '#000000' },
  
  // 3. Corporate (Deep Blue, White BG)
  corporate: { dark: '#0A1172', light: '#F8FAFC' },
  
  // 4. Pastel Vibes (Soft Purple, Cream BG)
  pastel: { dark: '#6B4F8A', light: '#FFE6E6' },
  
  // 5. Candy Crush (Red Dots, Light Yellow BG)
  candy: { dark: '#FF6B6B', light: '#FFF5E4' },
  
  // 6. Royal Gold (Gold Dots, Dark Navy BG) - Ultra Premium
  royal: { dark: '#FFD700', light: '#001F3F' },
  
  // 7. Eco Green (Dark Green Dots, Off-White BG)
  eco: { dark: '#1B5E20', light: '#E8F5E9' }
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  // =============================================
  // 📥 SARE PARAMETERS LE LO
  // =============================================
  let {
    text,          // UPI link
    size = 350,    // QR size
    margin = 2,    // Border margin
    dark,          // Dots color (hex or name)
    light,         // Background color (hex or name)
    style,         // Pre-built style name
    logo,          // Logo URL (remote)
    logoSz = 0.22, // Logo size (0.1 to 0.4)
    border = 1     // White border around logo? (1 = yes, 0 = no)
  } = req.query;

  if (!text) {
    return res.status(400).send('Missing "text" parameter');
  }

  // =============================================
  // 🎨 STYLE APPLY KARO (Agar diya hai toh)
  // =============================================
  if (style && STYLES[style]) {
    const preset = STYLES[style];
    dark = preset.dark;
    light = preset.light;
  }

  // Default colors (Black & White)
  const darkColor = dark || '#000000';
  const lightColor = light || '#ffffff';

  try {
    // =============================================
    // 1️⃣ QR CODE GENERATE KARO
    // =============================================
    const qrBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H', // High error correction (logo ke liye zaroori)
      margin: parseInt(margin),
      width: parseInt(size),
      color: {
        dark: darkColor,
        light: lightColor,
      },
    });

    let finalBuffer = qrBuffer;

    // =============================================
    // 2️⃣ LOGO LOAD KARO (Remote ya Local)
    // =============================================
    let logoBuffer = null;
    const qrSize = parseInt(size);
    const logoSize = Math.floor(qrSize * parseFloat(logoSz));
    const hasBorder = parseInt(border) === 1;

    // Pehle Remote URL try karo
    if (logo && logo.startsWith('http')) {
      try {
        const response = await fetch(logo);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          logoBuffer = Buffer.from(arrayBuffer);
        }
      } catch (e) {
        console.log('Remote logo fetch fail, trying local...');
      }
    }

    // Agar remote nahi mila, toh local file try karo
    if (!logoBuffer) {
      const localPath = path.resolve(process.cwd(), 'FamPay.png');
      if (fs.existsSync(localPath)) {
        logoBuffer = fs.readFileSync(localPath);
      }
    }

    // =============================================
    // 3️⃣ LOGO KO CIRCULAR + BORDER BANAO
    // =============================================
    if (logoBuffer) {
      try {
        // Resize logo
        const resizedLogo = await sharp(logoBuffer)
          .resize(logoSize, logoSize, { fit: 'contain' })
          .toBuffer();

        // 🔵 White background circle (Border ke liye)
        const borderSize = hasBorder ? Math.floor(logoSize * 0.12) : 0;
        const totalSize = logoSize + (borderSize * 2);
        
        let finalLogo = resizedLogo;
        
        if (hasBorder) {
          // White circle banayein
          const whiteCircle = Buffer.from(`
            <svg width="${totalSize}" height="${totalSize}">
              <circle cx="${totalSize/2}" cy="${totalSize/2}" r="${totalSize/2}" fill="white"/>
            </svg>
          `);
          
          // Circle crop karo logo ko
          const circularLogo = await sharp(resizedLogo)
            .composite([
              {
                input: Buffer.from(`
                  <svg width="${logoSize}" height="${logoSize}">
                    <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="white"/>
                  </svg>
                `),
                blend: 'dest-in'
              }
            ])
            .png()
            .toBuffer();
          
          // White circle ke upar logo chipkao (Center)
          finalLogo = await sharp(whiteCircle)
            .composite([
              {
                input: circularLogo,
                gravity: 'centre',
              }
            ])
            .png()
            .toBuffer();
        } else {
          // Bina border ke sirf circle mask
          finalLogo = await sharp(resizedLogo)
            .composite([
              {
                input: Buffer.from(`
                  <svg width="${logoSize}" height="${logoSize}">
                    <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="white"/>
                  </svg>
                `),
                blend: 'dest-in'
              }
            ])
            .png()
            .toBuffer();
        }

        // =============================================
        // 4️⃣ LOGO KO QR PE CENTER KARO
        // =============================================
        finalBuffer = await sharp(qrBuffer)
          .composite([
            {
              input: finalLogo,
              gravity: 'centre',
            },
          ])
          .png()
          .toBuffer();

      } catch (logoErr) {
        console.log('Logo processing fail, returning plain QR');
        // Agar logo processing fail ho, toh sirf QR return karo
      }
    }

    // =============================================
    // 5️⃣ IMAGE RETURN KARO
    // =============================================
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(finalBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
