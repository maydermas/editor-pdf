// Guías con texto propio. Cada una se publica como página estática en /guias/<slug>/.
// El cuerpo es HTML sencillo; usa {{nombre}} para el nombre de la web.

export const guias = [
  {
    slug: 'como-editar-un-pdf',
    title: 'Cómo editar un PDF gratis desde el navegador',
    description: 'Añade texto, imágenes, formas y notas a cualquier PDF sin instalar programas. Paso a paso y con trucos para que el resultado quede limpio.',
    body: `
<p>Un PDF está pensado para verse igual en cualquier dispositivo, y por eso no se puede modificar como un documento de Word. Aun así, casi siempre lo que necesitas no es reescribir el documento, sino <strong>añadir algo encima</strong>: una fecha, un nombre, una corrección, una flecha que señale un dato o una nota para otra persona. Para eso no hace falta ningún programa de pago.</p>

<h2>Pasos para editar un PDF</h2>
<ol>
  <li><strong>Abre el archivo.</strong> En la página principal de {{nombre}}, arrastra el PDF a la zona de subida o pulsa «Elegir archivo». También puedes abrir una foto en PNG o JPG: se convierte en una página PDF.</li>
  <li><strong>Elige una herramienta</strong> en la barra superior: Texto, Dibujar, Resaltar, Tapar, Formas, Nota, Fecha, Marcas, Imagen o Firmar.</li>
  <li><strong>Haz clic en la página</strong> donde quieras el elemento. Con el texto, escribe directamente; con las formas y el resaltado, arrastra para darles tamaño.</li>
  <li><strong>Ajusta el estilo</strong> en la barra de propiedades: color, grosor, tamaño de letra, tipo de letra, negrita o cursiva.</li>
  <li><strong>Pulsa «Listo»</strong>, elige el formato (PDF, PDF comprimido, JPG o PNG) y descarga.</li>
</ol>

<h2>Cómo cambiar o borrar un texto que ya está en el PDF</h2>
<ol>
  <li>Elige la herramienta <strong>Texto</strong> (está activa al abrir el documento). Los textos del PDF se marcan al pasar el ratón por encima.</li>
  <li><strong>Pulsa el texto</strong> que quieras cambiar. Se abre para editar con su mismo tipo de letra, tamaño, negrita y color, y el original queda tapado con el color del fondo.</li>
  <li>Escribe el texto nuevo. Para <strong>borrarlo</strong>, deja el cuadro vacío y pulsa fuera.</li>
</ol>
<p>El resto de la página no se toca: conserva su formato original. Si el PDF es escaneado (una foto del papel), no tiene texto que se pueda pulsar; en ese caso usa <strong>Tapar</strong> y escribe encima con <strong>Texto</strong>.</p>
<p>El texto original queda oculto a la vista, pero puede seguir dentro del archivo. Si el dato es confidencial (un número de cuenta, por ejemplo), descarga como <strong>PDF comprimido</strong>: las páginas se convierten en imagen y el texto original desaparece del todo.</p>

<h2>Trucos útiles</h2>
<ul>
  <li><strong>Mover y redimensionar:</strong> con la herramienta Seleccionar, arrastra cualquier elemento. El cuadrado de la esquina inferior derecha cambia su tamaño.</li>
  <li><strong>Precisión:</strong> con un elemento seleccionado, las flechas del teclado lo mueven un punto; con Mayúsculas, diez.</li>
  <li><strong>Copiar y pegar:</strong> Ctrl+C y Ctrl+V duplican el elemento seleccionado, útil para repetir una marca en varias páginas.</li>
  <li><strong>Deshacer:</strong> Ctrl+Z deshace y Ctrl+Mayúsculas+Z rehace.</li>
  <li><strong>Zoom:</strong> usa los botones + y −, o mantén Ctrl mientras giras la rueda del ratón.</li>
</ul>

<h2>¿Es seguro editar un PDF en línea?</h2>
<p>Depende de la herramienta. En {{nombre}} el archivo <strong>no se sube a ningún servidor</strong>: todo el trabajo lo hace tu navegador y el documento desaparece al cerrar la pestaña. Por eso puedes usarlo incluso con documentos personales, como contratos o nóminas.</p>
`,
  },
  {
    slug: 'como-firmar-un-pdf',
    title: 'Cómo firmar un PDF sin imprimirlo',
    description: 'Dibuja, escribe o sube tu firma y colócala en el documento en menos de un minuto, desde el ordenador o el móvil.',
    body: `
<p>Imprimir un documento, firmarlo a mano, escanearlo y volver a enviarlo cuesta tiempo y papel. Para la mayoría de trámites del día a día (un presupuesto, una autorización del colegio o un contrato de alquiler entre particulares) basta con una <strong>firma manuscrita digitalizada</strong> colocada sobre el PDF.</p>

<h2>Pasos para firmar</h2>
<ol>
  <li>Abre el PDF en {{nombre}}.</li>
  <li>Pulsa <strong>Firmar</strong> en la barra de herramientas. Se abre una ventana con tres opciones:
    <ul>
      <li><strong>Dibujar:</strong> firma con el ratón, el dedo o un lápiz digital.</li>
      <li><strong>Escribir:</strong> teclea tu nombre y elige uno de los estilos caligráficos.</li>
      <li><strong>Subir imagen:</strong> usa una foto de tu firma, a ser posible en PNG con fondo transparente.</li>
    </ul>
  </li>
  <li>Elige el color de la tinta (negro, azul o rojo) y pulsa <strong>Usar firma</strong>.</li>
  <li>Haz clic en el lugar del documento donde debe ir la firma. Después puedes moverla y cambiar su tamaño.</li>
  <li>Pulsa <strong>Listo</strong> y descarga el PDF firmado.</li>
</ol>
<p>Tus tres últimas firmas se guardan solo en tu navegador, para que la próxima vez puedas reutilizarlas con un clic. Si usas un ordenador compartido, borra los datos del sitio al terminar.</p>

<h2>Consejos para que la firma quede bien</h2>
<ul>
  <li>Firma en grande dentro del recuadro y reduce después el tamaño sobre el documento: el trazo queda más suave.</li>
  <li>En el móvil, gira la pantalla en horizontal para tener más espacio al dibujar.</li>
  <li>Para firmar en una línea concreta, amplía el zoom antes de colocar la firma.</li>
  <li>Añade la fecha con la herramienta <strong>Fecha</strong>: inserta el día de hoy en formato dd/mm/aaaa.</li>
</ul>

<h2>¿Tiene validez legal?</h2>
<p>En la Unión Europea, el Reglamento eIDAS reconoce varios niveles de firma electrónica. Una firma manuscrita colocada como imagen es una <strong>firma electrónica simple</strong>: es válida para muchos acuerdos privados, pero su fuerza como prueba es menor que la de una firma avanzada o cualificada. Para trámites con la Administración, escrituras o documentos que exigen certificado digital, usa el certificado de la FNMT, el DNI electrónico o Cl@ve. Si tienes dudas sobre un documento concreto, consulta con un profesional.</p>
`,
  },
  {
    slug: 'como-comprimir-un-pdf',
    title: 'Cómo comprimir un PDF para enviarlo por correo',
    description: 'Reduce el peso de un PDF escaneado o lleno de imágenes y elige el equilibrio entre tamaño y calidad.',
    body: `
<p>Muchos servicios limitan el tamaño de los adjuntos: el correo suele aceptar hasta 20 o 25 MB y algunos portales de empleo o de la Administración se quedan en 2 a 5 MB. Los PDF que más pesan son los <strong>escaneados</strong> y los que llevan muchas fotos.</p>

<h2>Pasos para comprimir</h2>
<ol>
  <li>Abre el PDF en {{nombre}}.</li>
  <li>Pulsa <strong>Listo</strong>.</li>
  <li>Elige el formato <strong>PDF comprimido</strong>.</li>
  <li>Ajusta la <strong>calidad de imagen</strong>. Un 60 o 70 % suele dar un buen equilibrio; si el archivo sigue siendo grande, baja al 40 o 50 %.</li>
  <li>Pulsa <strong>Descargar</strong>. La ventana te indica el tamaño final.</li>
</ol>

<h2>Cómo funciona y cuándo conviene</h2>
<p>La compresión convierte cada página en una imagen JPEG optimizada. Funciona muy bien con documentos escaneados, fotos y presentaciones con mucho color. A cambio, el texto deja de poder seleccionarse o buscarse, igual que en un escaneo.</p>
<p>Si tu PDF es de texto generado por ordenador (un informe exportado desde Word, por ejemplo), seguramente ya pesa poco. En ese caso descarga en <strong>PDF</strong> normal para conservar el texto seleccionable.</p>

<h2>Otras formas de reducir el tamaño</h2>
<ul>
  <li><strong>Quita páginas que sobran:</strong> en el panel de miniaturas, pulsa el icono de la papelera de cada página.</li>
  <li><strong>Envía solo una parte:</strong> en la ventana de descarga escribe un rango, como <code>1-3</code>.</li>
  <li><strong>Divide el documento:</strong> marca «Un archivo por cada rango» para enviarlo en varios correos.</li>
</ul>
`,
  },
  {
    slug: 'como-unir-pdf',
    title: 'Cómo unir varios PDF en uno solo',
    description: 'Combina varios PDF y fotos en un único documento y ordena las páginas arrastrándolas.',
    body: `
<p>Juntar documentos es útil para enviar una solicitud completa (DNI, nóminas, certificados) en un solo archivo o para reunir los capítulos de un trabajo. Con {{nombre}} puedes combinar PDF e imágenes en el orden que quieras.</p>

<h2>Pasos para unir archivos</h2>
<ol>
  <li>En la página principal, pulsa <strong>Elegir archivo</strong> y selecciona <strong>varios archivos a la vez</strong> (mantén Ctrl o Cmd al hacer clic). También puedes arrastrarlos todos juntos.</li>
  <li>Se abren como un único documento, en el orden en que los elegiste.</li>
  <li>Si te falta alguno, pulsa <strong>Añadir archivo</strong> al pie del panel de páginas: se añade al final.</li>
  <li>Ordena las páginas <strong>arrastrando las miniaturas</strong>.</li>
  <li>Pulsa <strong>Listo</strong> y descarga el PDF combinado.</li>
</ol>

<h2>Consejos</h2>
<ul>
  <li><strong>Fotos de documentos:</strong> si sacas una foto al DNI con el móvil, súbela directamente en JPG; se convierte en una página.</li>
  <li><strong>Páginas giradas:</strong> usa los botones de girar de cada miniatura para enderezarlas antes de descargar.</li>
  <li><strong>Separadores:</strong> pulsa <strong>Página en blanco</strong> para añadir una página vacía y escribe en ella un título con la herramienta Texto.</li>
  <li><strong>Peso final:</strong> si el resultado es muy grande, descárgalo como PDF comprimido.</li>
</ul>
`,
  },
  {
    slug: 'como-dividir-un-pdf',
    title: 'Cómo dividir un PDF o extraer algunas páginas',
    description: 'Separa un PDF en varios archivos o guarda solo las páginas que necesitas usando rangos como 1-3,5.',
    body: `
<p>A veces solo necesitas una parte de un documento largo: el capítulo de un libro, la última nómina de un archivo anual o las páginas que tiene que firmar otra persona. En {{nombre}} se hace desde la ventana de descarga.</p>

<h2>Extraer páginas en un solo archivo</h2>
<ol>
  <li>Abre el PDF y pulsa <strong>Listo</strong>.</li>
  <li>En <strong>Páginas</strong>, escribe las que quieres. Por ejemplo, <code>2-4,7</code> guarda las páginas 2, 3, 4 y 7.</li>
  <li>Deja sin marcar «Un archivo por cada rango» y pulsa <strong>Descargar</strong>.</li>
</ol>

<h2>Dividir en varios archivos</h2>
<ol>
  <li>Escribe un rango por cada archivo que quieras obtener. Por ejemplo, <code>1-10, 11-20, 21-30</code>.</li>
  <li>Marca <strong>Un archivo por cada rango</strong>.</li>
  <li>Al descargar recibirás un ZIP con un PDF por rango, numerados en orden.</li>
</ol>

<h2>Cómo se escriben los rangos</h2>
<ul>
  <li>La numeración empieza en 1, como en las miniaturas.</li>
  <li>Separa los rangos con comas o espacios: <code>1-3,5</code> y <code>1-3 5</code> son lo mismo.</li>
  <li>Un rango al revés invierte el orden: <code>5-1</code> guarda las páginas de la 5 a la 1.</li>
  <li>Si escribes una página que no existe, la ventana te avisa antes de descargar.</li>
</ul>
`,
  },
  {
    slug: 'como-convertir-pdf-a-jpg',
    title: 'Cómo convertir un PDF a JPG o PNG',
    description: 'Convierte cada página de un PDF en una imagen para publicarla, insertarla en una presentación o enviarla por mensajería.',
    body: `
<p>Convertir un PDF en imágenes sirve para compartir una página por WhatsApp, publicarla en redes sociales o insertarla en una presentación. {{nombre}} lo hace sin subir el archivo a ningún servidor.</p>

<h2>Pasos</h2>
<ol>
  <li>Abre el PDF y pulsa <strong>Listo</strong>.</li>
  <li>Elige <strong>JPG</strong> o <strong>PNG</strong>.</li>
  <li>Si solo quieres algunas páginas, escríbelas en <strong>Páginas</strong> (por ejemplo, <code>1</code> o <code>3-5</code>).</li>
  <li>Pulsa <strong>Descargar</strong>. Con una sola página recibes la imagen; con varias, un ZIP con una imagen por página.</li>
</ol>

<h2>¿JPG o PNG?</h2>
<ul>
  <li><strong>JPG</strong> pesa menos y es ideal para fotos y páginas con mucho color. Puedes ajustar la calidad.</li>
  <li><strong>PNG</strong> no pierde calidad y deja el texto y las líneas más nítidos, a cambio de archivos más grandes. Es la mejor opción para planos, gráficos y capturas de texto.</li>
</ul>
<p>Las imágenes se generan al doble de resolución que la página para que se lean bien en pantallas de alta densidad. Los textos, firmas y dibujos que hayas añadido aparecen en la imagen.</p>

<h2>Y al revés: de imagen a PDF</h2>
<p>Si tienes fotos y necesitas un PDF, ábrelas directamente desde la página principal: cada imagen se convierte en una página. Después pulsa <strong>Listo</strong> y descarga en PDF.</p>
`,
  },
];
