// Páginas legales e institucionales. Son una plantilla de partida: revisa los datos
// de site.config.json y, si puedes, que un profesional las valide antes de publicar.
// Marcadores: {{nombre}}, {{web}}, {{email}}, {{titular}}, {{nif}}, {{direccion}}, {{pais}}, {{fecha}}

export const legales = [
  {
    slug: 'sobre-nosotros',
    title: 'Sobre nosotros',
    description: 'Quién está detrás de {{nombre}} y por qué hicimos un editor de PDF que no sube tus archivos a ningún servidor.',
    body: `
<p>{{nombre}} nació de una molestia muy común: para hacer algo tan sencillo como firmar un PDF o juntar dos documentos, la mayoría de webs piden registrarse, pagar una suscripción o subir el archivo a sus servidores.</p>
<p>Queríamos una herramienta que hiciera lo contrario:</p>
<ul>
  <li><strong>Sin registro:</strong> entras, editas y descargas.</li>
  <li><strong>Sin subir tus archivos:</strong> el documento se procesa dentro de tu navegador y nunca sale de tu equipo.</li>
  <li><strong>Gratis:</strong> la web se mantiene con publicidad, no con suscripciones.</li>
  <li><strong>En cualquier dispositivo:</strong> funciona en el ordenador, la tableta y el móvil, e incluso puedes instalarla como aplicación y usarla sin conexión.</li>
</ul>
<p>Seguimos mejorando las herramientas. Si echas algo en falta o encuentras un error, escríbenos a <a href="mailto:{{email}}">{{email}}</a>.</p>
`,
  },
  {
    slug: 'contacto',
    title: 'Contacto',
    description: 'Cómo ponerte en contacto con el equipo de {{nombre}}.',
    body: `
<p>Puedes escribirnos para sugerencias, errores, colaboraciones o cualquier consulta sobre la web:</p>
<p class="big-contact"><a href="mailto:{{email}}">{{email}}</a></p>
<p>Respondemos normalmente en un plazo de 48 horas laborables.</p>
<p><strong>Importante:</strong> no nos envíes tus documentos. {{nombre}} funciona en tu navegador y no necesitamos tus archivos para ayudarte. Si nos describes el problema (navegador, dispositivo y qué pasos seguiste), es suficiente.</p>
`,
  },
  {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    description: 'Información legal sobre el titular del sitio web {{nombre}} y las condiciones de uso.',
    body: `
<h2>1. Datos del titular</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:</p>
<ul>
  <li><strong>Titular:</strong> {{titular}}</li>
  <li><strong>NIF:</strong> {{nif}}</li>
  <li><strong>Domicilio:</strong> {{direccion}}, {{pais}}</li>
  <li><strong>Correo electrónico:</strong> <a href="mailto:{{email}}">{{email}}</a></li>
  <li><strong>Sitio web:</strong> {{web}}</li>
</ul>

<h2>2. Objeto</h2>
<p>{{nombre}} ofrece de forma gratuita herramientas para editar, firmar, anotar, organizar y convertir archivos PDF e imágenes. Todo el procesamiento se realiza en el navegador del usuario: los archivos no se envían ni se almacenan en servidores del titular.</p>

<h2>3. Condiciones de uso</h2>
<p>El acceso a la web es libre y no requiere registro. El usuario se compromete a utilizar las herramientas de forma lícita y a no editar ni firmar documentos sobre los que no tenga derechos o autorización, ni a falsificar documentos o firmas de terceros. El usuario es el único responsable de los documentos que procesa y del uso que hace de ellos.</p>

<h2>4. Responsabilidad</h2>
<p>El titular trabaja para que las herramientas funcionen correctamente, pero no garantiza la ausencia de errores ni la disponibilidad continua del servicio. Se recomienda conservar siempre una copia del documento original. El titular no se responsabiliza de los daños derivados del uso de la web ni del contenido de los sitios enlazados.</p>

<h2>5. Propiedad intelectual</h2>
<p>El diseño, los textos, el código y los elementos gráficos de la web pertenecen al titular o se usan con licencia. Los documentos que procesa el usuario son de su propiedad y el titular no adquiere ningún derecho sobre ellos.</p>

<h2>6. Publicidad</h2>
<p>La web muestra anuncios servidos por Google AdSense. Consulta la <a href="../politica-de-cookies/">política de cookies</a> y la <a href="../politica-de-privacidad/">política de privacidad</a> para más información.</p>

<h2>7. Legislación aplicable</h2>
<p>Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa vigente, en particular la de protección de consumidores y usuarios.</p>
<p class="muted">Última actualización: {{fecha}}</p>
`,
  },
  {
    slug: 'politica-de-privacidad',
    title: 'Política de privacidad',
    description: 'Qué datos trata {{nombre}}, con qué fin y cuáles son tus derechos.',
    body: `
<h2>Resumen</h2>
<ul>
  <li><strong>No necesitas cuenta:</strong> no pedimos nombre, correo ni contraseña.</li>
  <li><strong>Tus archivos no salen de tu equipo:</strong> los PDF e imágenes se procesan en tu navegador y no los recibimos ni guardamos.</li>
  <li><strong>Publicidad:</strong> Google puede usar cookies para mostrar anuncios, solo con tu consentimiento cuando la ley lo exige.</li>
</ul>

<h2>1. Responsable del tratamiento</h2>
<p>{{titular}}, NIF {{nif}}, con domicilio en {{direccion}}, {{pais}}. Contacto: <a href="mailto:{{email}}">{{email}}</a>.</p>

<h2>2. Datos que tratamos y para qué</h2>
<ul>
  <li><strong>Documentos que editas:</strong> no los tratamos. Se abren y procesan en la memoria de tu navegador y se descartan al cerrar la pestaña.</li>
  <li><strong>Firmas guardadas:</strong> si usas la herramienta de firma, tus tres últimas firmas se guardan en el almacenamiento local de tu navegador para que puedas reutilizarlas. No se envían a ningún servidor y puedes borrarlas eliminando los datos del sitio en tu navegador.</li>
  <li><strong>Datos técnicos de conexión:</strong> el proveedor de alojamiento puede registrar de forma temporal la dirección IP y datos técnicos de las visitas por motivos de seguridad y funcionamiento (interés legítimo, art. 6.1.f RGPD).</li>
  <li><strong>Publicidad:</strong> Google, como proveedor de AdSense, puede tratar identificadores de tu dispositivo y datos de navegación para mostrar y medir anuncios, personalizados o no según tu elección (consentimiento, art. 6.1.a RGPD). Más información en <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">cómo usa Google la información de los sitios que usan sus servicios</a>.</li>
  <li><strong>Correos que nos envíes:</strong> usamos tu dirección y tu mensaje solo para responderte, y los conservamos el tiempo necesario para atender la consulta.</li>
</ul>

<h2>3. Destinatarios</h2>
<p>No vendemos ni cedemos datos. Intervienen como proveedores el servicio de alojamiento de la web y Google Ireland Limited (publicidad). Google puede realizar transferencias internacionales amparadas en las cláusulas contractuales tipo de la Comisión Europea y en el Marco de Privacidad de Datos UE-EE. UU.</p>

<h2>4. Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:{{email}}">{{email}}</a>. Puedes retirar el consentimiento a la publicidad personalizada en cualquier momento desde el enlace «Preferencias de privacidad» del pie de página. Si consideras que no hemos atendido tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>

<h2>5. Menores</h2>
<p>La web no está dirigida a menores de 14 años y no recogemos conscientemente datos de menores.</p>
<p class="muted">Última actualización: {{fecha}}</p>
`,
  },
  {
    slug: 'politica-de-cookies',
    title: 'Política de cookies',
    description: 'Qué cookies y tecnologías similares usa {{nombre}} y cómo gestionarlas.',
    body: `
<h2>¿Qué son las cookies?</h2>
<p>Son pequeños archivos que una web guarda en tu navegador para recordar información sobre tu visita. Tecnologías parecidas, como el almacenamiento local, cumplen funciones similares.</p>

<h2>Cookies y almacenamiento que usamos</h2>
<div class="table-wrap">
<table>
  <thead><tr><th>Nombre</th><th>Titular</th><th>Finalidad</th><th>Duración</th></tr></thead>
  <tbody>
    <tr><td>editor-pdf:firmas (almacenamiento local)</td><td>{{nombre}}</td><td>Técnica: recordar tus últimas firmas para reutilizarlas. Solo se crea si usas la herramienta de firma.</td><td>Hasta que la borres</td></tr>
    <tr><td>Caché de la aplicación (service worker)</td><td>{{nombre}}</td><td>Técnica: permitir que la web funcione sin conexión.</td><td>Hasta que la borres</td></tr>
    <tr><td>FCCDCF, FCNEC</td><td>Google</td><td>Guardar tus preferencias de consentimiento.</td><td>Hasta 13 meses</td></tr>
    <tr><td>__gads, __gpi, __eoi</td><td>Google</td><td>Publicidad: mostrar anuncios, limitar su repetición y medir su rendimiento.</td><td>Hasta 13 meses</td></tr>
    <tr><td>IDE, DSID</td><td>Google (doubleclick.net)</td><td>Publicidad personalizada, solo si la aceptas.</td><td>Hasta 13 meses</td></tr>
  </tbody>
</table>
</div>
<p>Las cookies técnicas no necesitan consentimiento. Las de publicidad solo se instalan si las aceptas en el aviso que aparece en tu primera visita (los visitantes del Espacio Económico Europeo, Reino Unido y Suiza lo ven siempre). Google puede cambiar los nombres de sus cookies; la lista actualizada está en <a href="https://business.safety.google/adscookies/" rel="noopener">la información de Google sobre cookies publicitarias</a>.</p>

<h2>Cómo cambiar tu elección</h2>
<ul>
  <li>Pulsa «Preferencias de privacidad» en el pie de cualquier página para volver a abrir el aviso.</li>
  <li>También puedes borrar o bloquear las cookies desde la configuración de tu navegador (Chrome, Firefox, Safari o Edge). Si las bloqueas todas, algunas funciones pueden dejar de ir bien.</li>
</ul>
<p class="muted">Última actualización: {{fecha}}</p>
`,
  },
];
