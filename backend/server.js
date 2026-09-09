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
        // Agregamos return para detener la función aquí y no enviar múltiples respuestas
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

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: mpItems,
        back_urls: {
          success: 'http://127.0.0.1:5500/frontend/index.html?status=success',
          failure: 'http://127.0.0.1:5500/frontend/index.html?status=failure',
          pending: 'http://127.0.0.1:5500/frontend/index.html?status=pending'
        }
      }
    });

    return res.json({ init_point: result.init_point });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    // Agregamos return también en el catch por seguridad
    return res.status(500).json({ error: 'Error interno del servidor de pago' });
  }
});

// Webhook para descontar el stock tras pago confirmado por Mercado Pago
app.post('/api/webhook', (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'payment') {
    // En producción podrías consultar el pago a MP y descontar el stock de `products.json`
    console.log('Pago recibido id:', data.id);
  }
  
  res.sendStatus(200);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🏴‍☠️ Servidor de la Hermandad corriendo en http://localhost:${PORT}`);
});