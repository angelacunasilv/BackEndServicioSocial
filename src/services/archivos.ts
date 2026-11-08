import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ApiError } from '../http/errors';
import { mensajePdf } from '../config/constants';

export async function verificarPdf(archivo: Express.Multer.File) {
  const extension = /\.pdf$/i.test(archivo.originalname);
  const encabezado = /^%PDF-\d\.\d/.test(archivo.buffer.subarray(0, 8).toString('ascii'));
  const fin = /%%EOF\s*$/.test(archivo.buffer.subarray(-1024).toString('latin1'));
  try {
    if (extension && encabezado && fin && ['application/pdf', 'application/octet-stream'].includes(archivo.mimetype)) {
      const pdf = await PDFDocument.load(archivo.buffer, { throwOnInvalidObject: true });
      if (pdf.getPageCount() > 0) return archivo.buffer;
    }
  } catch {
    // Los PDF dañados o cifrados no son utilizables para la revisión.
  }
  throw new ApiError(400, 'PDF_INVALIDO', mensajePdf, [{ campo: 'archivo', mensaje: mensajePdf }]);
}

export async function generarPdf(datos: {
  institucion: string; folio: string; alumno: string; numeroControl: string;
  programa: string; horas: number; fecha: string; emisor: string;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 721;

  function linea(texto: string, size: number, font = regular) {
    const seguro = texto.replace(/[^\x20-\x7e\xa0-\xff]/gu, '?');
    page.drawText(seguro, { x: 54, y, size, font, maxWidth: 504, lineHeight: size + 5, color: rgb(0.1, 0.15, 0.21) });
    const lineas = Math.max(1, Math.ceil(font.widthOfTextAtSize(seguro, size) / 470));
    y -= lineas * (size + 5) + 13;
  }

  pdf.setTitle('Constancia de terminación de servicio social');
  linea(datos.institucion, 12, negrita);
  linea('Constancia de terminación de servicio social', 20, negrita);
  linea('Folio: ' + datos.folio, 11);
  linea('Fecha de emisión: ' + datos.fecha, 11);
  y -= 15;
  linea('Se hace constar que la persona identificada a continuación completó su servicio social.', 12);
  linea('Alumno: ' + datos.alumno, 12, negrita);
  linea('Número de control: ' + datos.numeroControl, 12);
  linea('Programa: ' + datos.programa, 12);
  linea('Horas acreditadas: ' + datos.horas, 12);
  y -= 42;
  linea('Emitida por: ' + datos.emisor, 12);
  linea('Jefatura del Departamento de Gestión Tecnológica y Vinculación', 11);
  y -= 18;
  linea('Firma institucional: ____________________________________', 11);
  return Buffer.from(await pdf.save());
}
