// Páginas para búsquedas concretas («firmar PDF gratis», «borrar texto de un PDF»…).
// Cada una se publica en /<slug>/ con botón al editor, pasos y preguntas frecuentes.
// `enlace` es el texto corto que se usa en los menús y pies de página.

export const herramientas = [
  {
    slug: 'firmar-pdf-gratis',
    enlace: 'Firmar PDF gratis',
    title: 'Firmar un PDF gratis y sin registrarte',
    description: 'Firma cualquier PDF desde el móvil o el ordenador: dibuja tu firma, escríbela o sube una foto. Sin cuentas, sin marcas de agua y sin subir el archivo.',
    pasos: [
      'Pulsa <strong>Abrir el editor</strong> y elige tu PDF.',
      'Toca <strong>Firmar</strong> en la barra de herramientas.',
      'Dibuja tu firma con el dedo o el ratón, escribe tu nombre con un estilo caligráfico o sube una foto de tu firma.',
      'Toca el sitio del documento donde va la firma. Luego puedes moverla y cambiar su tamaño.',
      'Pulsa <strong>Listo</strong> y descarga el PDF firmado.',
    ],
    body: `
<p>Muchos papeles del día a día solo necesitan tu firma: un presupuesto, una autorización del colegio, un parte de horas o un contrato entre particulares. Imprimirlos, firmarlos y escanearlos lleva un rato. Aquí lo haces en menos de un minuto y sin crear ninguna cuenta.</p>
<h2>Lo que te ahorras</h2>
<ul>
  <li><strong>Sin registro:</strong> no pedimos correo ni contraseña.</li>
  <li><strong>Sin marcas de agua:</strong> el PDF que descargas es tuyo, tal cual.</li>
  <li><strong>Sin subir el archivo:</strong> el documento se abre y se firma dentro de tu navegador. No pasa por ningún servidor.</li>
  <li><strong>Tu firma, guardada en tu equipo:</strong> las últimas firmas que uses se quedan en tu navegador para reutilizarlas con un toque.</li>
</ul>`,
    faq: [
      ['¿Una firma así es válida?', 'Es una firma electrónica simple. Sirve para muchos acuerdos privados, pero para trámites con la Administración o documentos que exigen certificado digital necesitas el certificado de la FNMT, el DNI electrónico o Cl@ve.'],
      ['¿Puedo firmar varias páginas?', 'Sí. Coloca la firma en una página, selecciónala y usa Ctrl + C y Ctrl + V para pegarla en las demás, o vuelve a pulsar Firmar y elige la firma guardada.'],
      ['¿Funciona en el móvil?', 'Sí. Gira el móvil en horizontal para tener más espacio al dibujar la firma.'],
    ],
  },
  {
    slug: 'escribir-en-un-pdf',
    enlace: 'Escribir en un PDF',
    title: 'Escribir en un PDF online, gratis',
    description: 'Añade texto en cualquier parte de un PDF: nombres, fechas, respuestas o comentarios. Elige tipo de letra, tamaño y color, y descárgalo al momento.',
    pasos: [
      'Abre tu PDF en el editor.',
      'La herramienta <strong>Texto</strong> ya está activa. Toca o haz clic en el hueco donde quieres escribir.',
      'Escribe. En la barra de arriba cambias el color, el tamaño, el tipo de letra, la negrita y la cursiva.',
      'Para colocarlo mejor, usa <strong>Seleccionar</strong> y arrastra el texto.',
      'Pulsa <strong>Listo</strong> y descarga.',
    ],
    body: `
<p>Un PDF no se puede abrir como un documento de Word, pero casi nunca hace falta: lo normal es querer <strong>añadir algo encima</strong>. Un nombre en un formulario, la respuesta a una pregunta, un número de cuenta o una corrección para otra persona.</p>
<h2>Trucos para que quede bien</h2>
<ul>
  <li><strong>Amplía antes de escribir:</strong> pellizca con dos dedos o usa Ctrl + rueda del ratón para colocar el texto justo en la línea.</li>
  <li><strong>Mueve la página arrastrando:</strong> con la herramienta Texto, arrastra para desplazarte y toca sin arrastrar para escribir.</li>
  <li><strong>Mismo aspecto que el documento:</strong> elige Serif (Times) si el PDF usa letra con remates, o Sans (Helvetica) si no.</li>
  <li><strong>Fecha de hoy con un toque:</strong> la herramienta Fecha la escribe en formato dd/mm/aaaa.</li>
</ul>`,
    faq: [
      ['¿Puedo cambiar un texto que ya está en el PDF?', 'Sí, si el PDF tiene texto real (no es una foto escaneada). Con la herramienta Texto, pulsa sobre el texto y escribe el nuevo: se respeta su letra, tamaño y color.'],
      ['¿El texto que añado se puede copiar luego?', 'Sí. Al descargar como PDF normal, el texto que escribes queda como texto real dentro del documento.'],
      ['¿Hay límite de páginas?', 'No ponemos límite. Depende de la memoria de tu dispositivo; en móviles antiguos los PDF muy grandes pueden ir lentos.'],
    ],
  },
  {
    slug: 'rellenar-pdf-desde-el-movil',
    enlace: 'Rellenar un PDF en el móvil',
    title: 'Rellenar un PDF desde el móvil',
    description: 'Completa formularios en PDF desde el móvil: escribe en los huecos, marca casillas, pon la fecha y firma. Sin instalar nada y sin registrarte.',
    pasos: [
      'Abre el editor en el navegador del móvil y elige el PDF (también desde WhatsApp o el correo, si lo descargas primero).',
      'Toca un hueco con la herramienta <strong>Texto</strong> y escribe.',
      'Para casillas, usa <strong>Marcas</strong> y elige ✓, ✗ o punto.',
      'Añade la fecha con <strong>Fecha</strong> y tu firma con <strong>Firmar</strong>.',
      'Pulsa <strong>Listo</strong> y descarga. Desde ahí puedes compartirlo.',
    ],
    body: `
<p>Te mandan un formulario en PDF y no tienes ordenador a mano. Con el móvil basta: el editor funciona en el navegador y está pensado para usarse con el dedo.</p>
<h2>Gestos que te ayudan</h2>
<ul>
  <li><strong>Un dedo:</strong> arrastra para moverte por el documento.</li>
  <li><strong>Dos dedos:</strong> pellizca para ampliar o reducir.</li>
  <li><strong>Tocar sin arrastrar:</strong> abre un cuadro para escribir en ese punto.</li>
</ul>
<h2>Instálalo como app</h2>
<p>Si lo vas a usar a menudo, pulsa <strong>Instalar app</strong> en la portada (en iPhone: Compartir y luego «Añadir a pantalla de inicio»). Se abre como una aplicación más y funciona también sin conexión.</p>`,
    faq: [
      ['¿Sirve para formularios con campos rellenables?', 'Puedes escribir encima de cualquier formulario, tenga campos o no. El texto se coloca donde tú toques.'],
      ['¿Mis datos se envían a algún sitio?', 'No. El PDF se abre y se edita dentro de tu móvil; no se sube a ningún servidor.'],
      ['¿Funciona en iPhone y Android?', 'Sí, en Safari, Chrome y los navegadores actuales de ambos sistemas.'],
    ],
  },
  {
    slug: 'borrar-texto-de-un-pdf',
    enlace: 'Borrar texto de un PDF',
    title: 'Borrar o cambiar texto de un PDF',
    description: 'Cambia una palabra, corrige una cifra o borra una línea de un PDF manteniendo el formato del resto del documento. Gratis y sin registro.',
    pasos: [
      'Abre el PDF en el editor. La herramienta <strong>Texto</strong> ya está activa.',
      'Pasa el ratón o toca sobre el texto que quieres cambiar: se marca.',
      'Púlsalo. Se abre con la misma letra, tamaño y color, y el original queda tapado con el color del fondo.',
      'Escribe el texto nuevo. Para <strong>borrarlo</strong>, deja el cuadro vacío y pulsa fuera.',
      'Pulsa <strong>Listo</strong> y descarga.',
    ],
    body: `
<p>Un error en una factura, una fecha que ha cambiado o un nombre mal escrito. No hace falta rehacer el documento entero: cambias solo esa parte y el resto de la página se queda exactamente como estaba.</p>
<h2>Cuándo no se puede</h2>
<p>Si el PDF es un <strong>documento escaneado</strong> (una foto del papel), no tiene texto que se pueda pulsar. En ese caso usa <strong>Tapar</strong> para cubrir la zona con un rectángulo blanco y escribe encima con <strong>Texto</strong>.</p>
<h2>Si el dato es confidencial</h2>
<p>El texto original queda oculto a la vista, pero puede seguir dentro del archivo. Para que desaparezca del todo, descarga como <strong>PDF comprimido</strong>: las páginas se convierten en imagen y el texto de debajo se elimina.</p>`,
    faq: [
      ['¿Se nota que lo he cambiado?', 'Se usa el mismo tipo de letra cuando es posible y el color del fondo se toma de la propia página, así que en la mayoría de documentos no se aprecia.'],
      ['¿Puedo borrar un párrafo entero?', 'Sí. Pulsa cada línea y déjala vacía, o usa Tapar y arrastra para cubrir todo el bloque.'],
      ['¿Es legal modificar un PDF?', 'Editar tus propios documentos sí. Alterar documentos oficiales o de otras personas para engañar no lo es.'],
    ],
  },
  {
    slug: 'eliminar-paginas-de-un-pdf',
    enlace: 'Eliminar páginas de un PDF',
    title: 'Eliminar páginas de un PDF',
    description: 'Quita las páginas que sobran de un PDF, cámbialas de orden o gíralas. También puedes guardar solo algunas páginas. Gratis y sin subir el archivo.',
    pasos: [
      'Abre el PDF en el editor. A la izquierda verás las miniaturas de las páginas (en el móvil, toca el icono de páginas arriba).',
      'Pulsa la <strong>papelera</strong> bajo la página que quieres quitar.',
      'Arrastra las miniaturas para cambiar el orden o usa las flechas para girarlas.',
      'Pulsa <strong>Listo</strong> y descarga.',
    ],
    body: `
<p>Una página en blanco al final, un anexo que no hace falta o una hoja escaneada del revés. Quitarla o arreglarla lleva unos segundos.</p>
<h2>Guardar solo algunas páginas</h2>
<p>Si prefieres no borrar nada, al pulsar <strong>Listo</strong> escribe las páginas que quieres en el campo «Páginas», por ejemplo <code>1-3,5</code>. Solo esas se incluirán en el archivo. Si marcas «Un archivo por cada rango», se descargan por separado en un ZIP.</p>
<h2>Añadir páginas</h2>
<p>Debajo de las miniaturas tienes <strong>Página en blanco</strong> y <strong>Añadir archivo</strong>, para meter otro PDF o una foto dentro del documento.</p>`,
    faq: [
      ['¿Se pierde calidad al quitar páginas?', 'No. Si descargas como PDF normal, las páginas que quedan se conservan igual que en el original.'],
      ['¿Puedo deshacer si borro la que no era?', 'Sí. Pulsa deshacer (o Ctrl + Z) antes de descargar.'],
      ['¿Y unir dos PDF?', 'Usa Añadir archivo debajo de las miniaturas y elige el segundo PDF: sus páginas se añaden al final.'],
    ],
  },
  {
    slug: 'tapar-datos-en-un-pdf',
    enlace: 'Tapar datos en un PDF',
    title: 'Tapar datos personales en un PDF',
    description: 'Oculta tu DNI, número de cuenta o dirección antes de enviar un PDF. Cubre la zona y descárgalo de forma que el dato desaparezca de verdad.',
    pasos: [
      'Abre el PDF en el editor.',
      'Elige <strong>Tapar</strong> y arrastra sobre el dato que quieres ocultar. Se cubre con un rectángulo blanco.',
      'Pulsa <strong>Listo</strong> y elige <strong>PDF comprimido</strong> para que el texto de debajo se elimine.',
      'Descarga y comprueba el resultado antes de enviarlo.',
    ],
    body: `
<p>A veces te piden un documento pero no todo lo que hay en él: una nómina sin el número de cuenta, un contrato sin la dirección o un DNI con solo algunos datos visibles. Tapar esa parte antes de enviarlo protege tu información.</p>
<h2>Por qué elegir «PDF comprimido»</h2>
<p>Al tapar un texto, deja de verse, pero en un PDF normal puede seguir dentro del archivo y alguien podría copiarlo. Con <strong>PDF comprimido</strong> cada página se guarda como imagen: lo que está tapado desaparece de verdad y el archivo además pesa menos.</p>
<h2>Tu documento no sale de tu equipo</h2>
<p>Todo el proceso ocurre en tu navegador. El PDF no se sube a ningún servidor, lo que tiene sentido precisamente cuando lo que quieres es proteger datos personales.</p>`,
    faq: [
      ['¿Basta con poner un rectángulo encima?', 'Para que no se vea, sí. Para que no se pueda recuperar, descarga como PDF comprimido.'],
      ['¿El PDF comprimido se ve peor?', 'Puede perder algo de nitidez. Sube la calidad de imagen en la ventana de descarga si lo necesitas.'],
      ['¿Puedo tapar en varias páginas a la vez?', 'Tapa en una página, selecciona el rectángulo y pégalo en las demás con Ctrl + C y Ctrl + V.'],
    ],
  },
];
