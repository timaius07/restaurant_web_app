const path = require('path');
const fs = require('fs');

const { generateInvoicePDFBuffer } = require('../../restaurant_web_api/services/pdfInvoiceService');

async function test() {
  try {
    console.log('Iniciando prueba de generación de PDF para Régimen Simplificado...');
    const buffer = await generateInvoicePDFBuffer({
      settings: {
        nombreRestaurante: 'Soda La Tica',
        razonSocial: 'Soda La Tica S.A.',
        cedulaJuridica: '3-101-123456',
        telefono: '2222-3333',
        correo: 'contacto@sodalatica.cr',
        direccion: '200 Sur del Parque Central, San José',
      },
      factura: {
        id: 10,
        numeroFactura: 'F-000010',
        fechaEmision: new Date('2026-09-20T14:28:00'),
        subtotal: 11600.00,
        total: 11600.00,
        servicio: 0,
      },
      cliente: {
        nombre: 'MARCO CAMBRONERO VARGAS',
        identificacionFiscal: '206880929',
        telefono: '71847701',
        email: 'timaius22@gmail.com',
      },
      detalles: [
        {
          codigo: '1',
          descripcion: 'Arroz con Pollo',
          cantidad: 1,
          precioMomento: 5000.00,
        },
        {
          codigo: '2',
          descripcion: 'Arroz con Cerdo',
          cantidad: 1,
          precioMomento: 5000.00,
        },
        {
          codigo: '78',
          descripcion: 'Limonada',
          cantidad: 1,
          precioMomento: 800.00,
        },
        {
          codigo: '79',
          descripcion: 'Tamarindo (Natural)',
          cantidad: 1,
          precioMomento: 800.00,
        },
      ],
      metodoPagoLabel: 'Efectivo',
      origenLabel: 'Mesa 3',
    });

    console.log(`✅ PDF generado exitosamente: ${buffer.length} bytes`);

    const outputPath = path.join(__dirname, 'test_factura_output.pdf');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Archivo guardado para verificación: ${outputPath}`);
  } catch (err) {
    console.error('❌ Error durante la prueba de PDF:', err);
    process.exit(1);
  }
}

test();
