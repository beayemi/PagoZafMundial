import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const app = express();
app.use(cors());
app.use(express.json());

// Reemplaza con tu Access Token de Pruebas de Mercado Pago (Sandbox)
const client = new MercadoPagoConfig({
  accessToken: 'APP_USR-1110499587048488-090613-a33b1e597f5978be47224c1bc5fb2002-304343911'
});

const PRODUCTS_FILE = path.resolve('products.json');

const getProducts = () => JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
const saveProducts = (data) => fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));

// Obtener catálogo con stock actualizado
app.get('/api/products', (req, res) => {
  res.json(getProducts());
});

// Crear preferencia de pago en Mercado Pago
app.post('/api/create-preference', async (req, res) => {
  try {
    const { items } = req.body;
    const products = getProducts();

    const mpItems = [];
    for (const item of items) {
      const dbProduct = products.find(p => p.id === item.id);
      if (!dbProduct || dbProduct.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para: ${dbProduct?.title || item.id}` });
      }

      mpItems.push({
        id: dbProduct.id,
        title: dbProduct.title,
        unit_price: Number(dbProduct.price),
        quantity: Number(item.quantity),
        currency_id: 'CLP'
      });
    }

    // ACA ESTÁ EL CAMBIO DE LAS URLS
    // ⚠️ REEMPLAZA "https://tu-proyecto-en.vercel.app" POR TU LINK DE VERCEL REAL ⚠️
    const FRONTEND_URL = 'https://tu-proyecto-en.vercel.app'; 

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: mpItems,
        back_urls: {
          success: `${FRONTEND_URL}/?status=success`,
          failure: `${FRONTEND_URL}/?status=failure`,
          pending: `${FRONTEND_URL}/?status=pending`
        },
        auto_return: 'approved' // Para que devuelva al usuario a tu web automáticamente
      }
    });

    return res.json({ init_point: result.init_point });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return res.status(500).json({ error: 'Error interno del servidor de pago' });
  }
});

app.post('/api/webhook', (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment') {
    console.log('Pago recibido id:', data.id);
  }
  res.sendStatus(200);
});

// ACA ESTÁ EL CAMBIO DEL PUERTO PARA RENDER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏴‍☠️ Servidor de la Hermandad corriendo en el puerto ${PORT}`);
});