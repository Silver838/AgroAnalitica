const STORAGE_KEY = "agroanalitica_registros";
let registros = cargarRegistros();
let filtros = { texto: "", tipo: "", cultivo: "", categoria: "", desde: "", hasta: "", orden: "date-desc" };

const formatoCOP = valor => new Intl.NumberFormat("es-CO", {style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(valor)||0);
const formatoNumero = valor => new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(Number(valor)||0);
const escaparHTML = texto => String(texto ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function cargarRegistros(){try{const datos=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(datos)?datos:[]}catch{return[]}}
function guardarRegistros(){localStorage.setItem(STORAGE_KEY,JSON.stringify(registros))}
function obtenerTotales(lista=registros){
    const costos=lista.filter(r=>r.tipo==="gasto").reduce((s,r)=>s+(Number(r.valor)||0),0);
    const ingresos=lista.filter(r=>r.tipo==="venta").reduce((s,r)=>s+(Number(r.valor)||0),0);
    const produccion=lista.filter(r=>r.tipo==="produccion").reduce((s,r)=>s+(Number(r.cantidad)||0),0);
    return{costos,ingresos,ganancia:ingresos-costos,produccion};
}
function obtenerCultivos(){return [...new Set(registros.map(r=>r.cultivo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"))}
function obtenerProduccion(cultivo){return registros.filter(r=>r.cultivo===cultivo&&r.tipo==="produccion").reduce((s,r)=>s+(Number(r.cantidad)||0),0)}
function nombreTipo(tipo){return{gasto:"Gasto",produccion:"Producción",venta:"Venta"}[tipo]||tipo}
function detalleRegistro(r){
    if(r.tipo==="produccion")return `${formatoNumero(r.cantidad)} kg producidos`;
    if(r.tipo==="venta"&&Number(r.cantidad)>0&&Number(r.precioKg)>0)return `${formatoNumero(r.cantidad)} kg × ${formatoCOP(r.precioKg)} = ${formatoCOP(r.valor)}`;
    if(r.tipo==="venta")return `${formatoCOP(r.valor)} (registro anterior)`;
    return formatoCOP(r.valor);
}
function fechaActualLocal(){const f=new Date();return new Date(f.getTime()-f.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function mostrarPagina(nombre){
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===nombre));
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===nombre));
    const titulos={dashboard:"Panel principal",registros:"Registros agrícolas",cultivos:"Mis cultivos",analisis:"Análisis de información",reportes:"Reportes"};
    document.getElementById("page-title").textContent=titulos[nombre]||"AgroAnalítica";
    actualizarInterfaz();
}
function crearGrafica(id,datos,sufijo=" kg",esMoneda=false){
    const cont=document.getElementById(id);const elementos=Object.entries(datos).filter(([,v])=>Number(v)>0);
    if(!elementos.length){cont.innerHTML='<div class="chart-empty">Todavía no hay datos suficientes para generar esta gráfica.</div>';return}
    const max=Math.max(...elementos.map(([,v])=>Number(v)));
    cont.innerHTML=elementos.map(([nombre,valor])=>{
        const altura=Math.max(4,Number(valor)/max*125);
        const etiqueta=esMoneda?formatoCOP(valor):formatoNumero(valor)+sufijo;
        return `<div class="bar-item"><span class="bar-value">${etiqueta}</span><div class="bar" style="height:${altura}px"></div><span class="bar-label">${escaparHTML(nombre)}</span></div>`;
    }).join("");
}
function actualizarDashboard(){
    const t=obtenerTotales();
    document.getElementById("total-costos").textContent=formatoCOP(t.costos);
    document.getElementById("total-ingresos").textContent=formatoCOP(t.ingresos);
    document.getElementById("total-ganancia").textContent=formatoCOP(t.ganancia);
    document.getElementById("total-produccion").textContent=formatoNumero(t.produccion)+" kg";
    document.getElementById("balance-ingresos").textContent=formatoCOP(t.ingresos);
    document.getElementById("balance-costos").textContent=formatoCOP(t.costos);
    document.getElementById("balance-neto").textContent=formatoCOP(t.ganancia);
    const mayor=Math.max(t.ingresos,t.costos,1);
    document.getElementById("income-bar").style.width=(t.ingresos/mayor*100)+"%";
    document.getElementById("cost-bar").style.width=(t.costos/mayor*100)+"%";
    const prod={};obtenerCultivos().forEach(c=>prod[c]=obtenerProduccion(c));crearGrafica("dashboard-chart",prod);
    const recientes=[...registros].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,5);
    const tabla=document.getElementById("recent-list");
    if(!recientes.length){tabla.innerHTML='<div class="empty-state">Aún no tienes movimientos registrados.</div>';return}
    tabla.innerHTML=`<table><thead><tr><th>Descripción</th><th>Tipo</th><th>Fecha</th><th>Detalle</th></tr></thead><tbody>${recientes.map(r=>`<tr><td><strong>${escaparHTML(r.descripcion)}</strong><br>${escaparHTML(r.cultivo)}</td><td><span class="type-tag ${escaparHTML(r.tipo)}">${nombreTipo(r.tipo)}</span></td><td>${escaparHTML(r.fecha)}</td><td>${detalleRegistro(r)}</td></tr>`).join("")}</tbody></table>`;
}
function llenarFiltroCultivos(){
    const select=document.getElementById("filter-crop");const actual=select.value;
    select.innerHTML='<option value="">Todos los cultivos</option>'+obtenerCultivos().map(c=>`<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join("");
    select.value=obtenerCultivos().includes(actual)?actual:"";
}
function obtenerRegistrosFiltrados(){
    let lista=[...registros];
    if(filtros.texto){const q=filtros.texto.toLocaleLowerCase("es");lista=lista.filter(r=>`${r.cultivo} ${r.descripcion}`.toLocaleLowerCase("es").includes(q))}
    if(filtros.tipo)lista=lista.filter(r=>r.tipo===filtros.tipo);
    if(filtros.cultivo)lista=lista.filter(r=>r.cultivo===filtros.cultivo);
    if(filtros.categoria)lista=lista.filter(r=>r.tipo==="gasto"&&(r.categoria||"")===filtros.categoria);
    if(filtros.desde)lista=lista.filter(r=>String(r.fecha)>=filtros.desde);
    if(filtros.hasta)lista=lista.filter(r=>String(r.fecha)<=filtros.hasta);
    lista.sort((a,b)=>{
        if(filtros.orden==="date-asc")return String(a.fecha).localeCompare(String(b.fecha));
        if(filtros.orden==="value-desc")return (Number(b.valor)||0)-(Number(a.valor)||0);
        if(filtros.orden==="value-asc")return (Number(a.valor)||0)-(Number(b.valor)||0);
        return String(b.fecha).localeCompare(String(a.fecha));
    });
    return lista;
}
function actualizarTablaRegistros(){
    llenarFiltroCultivos();
    const cont=document.getElementById("records-table");const lista=obtenerRegistrosFiltrados();
    document.getElementById("record-count").textContent=`${lista.length} de ${registros.length} ${registros.length===1?"registro":"registros"}`;
    const suma=lista.reduce((s,r)=>s+(Number(r.valor)||0),0);
    document.getElementById("filter-summary").textContent=lista.length?`Mostrando ${lista.length} movimiento(s). Valor acumulado de gastos y ventas visibles: ${formatoCOP(suma)}.`:"No se encontraron movimientos con los filtros seleccionados.";
    if(!lista.length){cont.innerHTML='<div class="empty-state">No hay registros que coincidan con la búsqueda o los filtros.</div>';return}
    cont.innerHTML=`<table><thead><tr><th>Fecha</th><th>Cultivo</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th>Detalle</th><th>Acciones</th></tr></thead><tbody>${lista.map(r=>`<tr><td>${escaparHTML(r.fecha)}</td><td><strong>${escaparHTML(r.cultivo)}</strong></td><td>${escaparHTML(r.descripcion)}</td><td><span class="type-tag ${escaparHTML(r.tipo)}">${nombreTipo(r.tipo)}</span></td><td>${escaparHTML(r.categoria||"—")}</td><td>${detalleRegistro(r)}</td><td><button class="edit-btn" data-edit="${escaparHTML(r.id)}">Editar</button><button class="delete-btn" data-delete="${escaparHTML(r.id)}">Eliminar</button></td></tr>`).join("")}</tbody></table>`;
}
function actualizarCultivos(){
    const cultivos=obtenerCultivos();const total=obtenerTotales();
    document.getElementById("crop-overview").innerHTML=`
      <div class="overview-card"><span>Cultivos con actividad</span><strong>${cultivos.length}</strong></div>
      <div class="overview-card"><span>Producción total registrada</span><strong>${formatoNumero(total.produccion)} kg</strong></div>
      <div class="overview-card"><span>Movimientos registrados</span><strong>${registros.length}</strong></div>`;
    const cont=document.getElementById("crop-grid");
    if(!cultivos.length){cont.innerHTML='<div class="panel empty-state">Cuando registres información, tus cultivos aparecerán aquí.</div>';return}
    cont.innerHTML=cultivos.map(c=>{
        const mov=registros.filter(r=>r.cultivo===c);const t=obtenerTotales(mov);
        const ultima=mov.map(r=>r.fecha).sort().at(-1)||"—";
        const cantidadVentas=mov.filter(r=>r.tipo==="venta").reduce((s,r)=>s+(Number(r.cantidad)||0),0);
        return `<article class="crop-card"><div class="crop-card-head"><div class="crop-symbol">♧</div><div><h3>${escaparHTML(c)}</h3><small>${mov.length} movimiento(s) · Último: ${escaparHTML(ultima)}</small></div></div>
        <div class="crop-metric"><span>Producción</span><strong>${formatoNumero(t.produccion)} kg</strong></div>
        <div class="crop-metric"><span>Cantidad vendida</span><strong>${formatoNumero(cantidadVentas)} kg</strong></div>
        <div class="crop-metric"><span>Costos</span><strong>${formatoCOP(t.costos)}</strong></div>
        <div class="crop-metric"><span>Ingresos</span><strong>${formatoCOP(t.ingresos)}</strong></div>
        <div class="crop-metric"><span>Resultado estimado</span><strong>${formatoCOP(t.ganancia)}</strong></div></article>`;
    }).join("");
}
function actualizarAnalisis(){
    const t=obtenerTotales(),cultivos=obtenerCultivos();const margen=t.ingresos>0?t.ganancia/t.ingresos*100:0;
    document.getElementById("analysis-margin").textContent=formatoNumero(margen)+"%";
    document.getElementById("analysis-crops").textContent=cultivos.length;document.getElementById("analysis-records").textContent=registros.length;
    const prod={};cultivos.forEach(c=>prod[c]=obtenerProduccion(c));crearGrafica("analysis-production-chart",prod);
    crearGrafica("finance-chart",{"Ingresos":t.ingresos,"Costos":t.costos},"",true);
    const gastos={};registros.filter(r=>r.tipo==="gasto").forEach(r=>{const cat=r.categoria||"Sin categoría";gastos[cat]=(gastos[cat]||0)+(Number(r.valor)||0)});
    crearGrafica("expense-chart",gastos,"",true);
    const meses={};registros.forEach(r=>{if(!r.fecha)return;const [y,m]=r.fecha.split("-");const key=`${y}-${m}`;meses[key]=(meses[key]||0)+1});
    const mesesOrdenados=Object.fromEntries(Object.entries(meses).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([k,v])=>[k.slice(5)+"/"+k.slice(0,4),v]));
    crearGrafica("monthly-chart",mesesOrdenados," mov.");
    document.getElementById("financial-indicators").innerHTML=`
      <div class="indicator"><span>Total de costos</span><strong>${formatoCOP(t.costos)}</strong></div>
      <div class="indicator"><span>Total de ingresos</span><strong>${formatoCOP(t.ingresos)}</strong></div>
      <div class="indicator"><span>Ganancia o pérdida estimada</span><strong>${formatoCOP(t.ganancia)}</strong></div>
      <div class="indicator"><span>Margen sobre ingresos</span><strong>${formatoNumero(margen)}%</strong></div>
      <div class="indicator"><span>Unidades producidas</span><strong>${formatoNumero(t.produccion)} kg</strong></div>
      <div class="indicator"><span>Registros almacenados</span><strong>${registros.length}</strong></div>`;
}
function actualizarReporte(){
    const t=obtenerTotales();
    document.getElementById("report-summary").innerHTML=`
      <div class="report-item"><span>Costos acumulados</span><strong>${formatoCOP(t.costos)}</strong></div>
      <div class="report-item"><span>Ingresos acumulados</span><strong>${formatoCOP(t.ingresos)}</strong></div>
      <div class="report-item"><span>Resultado neto estimado</span><strong>${formatoCOP(t.ganancia)}</strong></div>
      <div class="report-item"><span>Producción total</span><strong>${formatoNumero(t.produccion)} kg</strong></div>
      <div class="report-item"><span>Cultivos diferentes</span><strong>${obtenerCultivos().length}</strong></div>
      <div class="report-item"><span>Movimientos registrados</span><strong>${registros.length}</strong></div>`;
    const crops=obtenerCultivos();const rc=document.getElementById("report-crops");
    rc.innerHTML=crops.length?`<table><thead><tr><th>Cultivo</th><th>Producción</th><th>Costos</th><th>Ingresos</th><th>Resultado estimado</th></tr></thead><tbody>${crops.map(c=>{const t=obtenerTotales(registros.filter(r=>r.cultivo===c));return `<tr><td><strong>${escaparHTML(c)}</strong></td><td>${formatoNumero(t.produccion)} kg</td><td>${formatoCOP(t.costos)}</td><td>${formatoCOP(t.ingresos)}</td><td>${formatoCOP(t.ganancia)}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-state">No hay cultivos para resumir.</div>';
    const cats={};registros.filter(r=>r.tipo==="gasto").forEach(r=>{const c=r.categoria||"Sin categoría";cats[c]=(cats[c]||0)+(Number(r.valor)||0)});
    const re=document.getElementById("report-expenses");const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
    re.innerHTML=entries.length?`<table><thead><tr><th>Categoría</th><th>Total</th></tr></thead><tbody>${entries.map(([c,v])=>`<tr><td>${escaparHTML(c)}</td><td>${formatoCOP(v)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">No hay gastos registrados.</div>';
}
function actualizarInterfaz(){actualizarDashboard();actualizarTablaRegistros();actualizarCultivos();actualizarAnalisis();actualizarReporte()}

// Navegación y accesos rápidos
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>mostrarPagina(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>mostrarPagina(b.dataset.go)));

// Formulario y edición
const formulario=document.getElementById("record-form"),tipoSelect=document.getElementById("tipo");
const campoValor=document.getElementById("amount-label"),campoCantidad=document.getElementById("quantity-label"),campoCategoria=document.getElementById("category-label"),campoPrecioVenta=document.getElementById("sale-price-label"),campoTotalVenta=document.getElementById("sale-total-label");
const valorInput=document.getElementById("valor"),cantidadInput=document.getElementById("cantidad"),categoriaInput=document.getElementById("categoria"),precioVentaInput=document.getElementById("precio-kg"),totalVentaInput=document.getElementById("venta-total");
function actualizarTotalVenta(){const c=Number(cantidadInput.value),p=Number(precioVentaInput.value);totalVentaInput.value=formatoCOP(c>0&&p>0?c*p:0)}
function actualizarCampos(){
    const tipo=tipoSelect.value,esGasto=tipo==="gasto",esProduccion=tipo==="produccion",esVenta=tipo==="venta";
    campoCategoria.classList.toggle("hidden",!esGasto);campoValor.classList.toggle("hidden",!esGasto);campoCantidad.classList.toggle("hidden",!(esProduccion||esVenta));campoPrecioVenta.classList.toggle("hidden",!esVenta);campoTotalVenta.classList.toggle("hidden",!esVenta);
    document.getElementById("quantity-label-text").textContent=esVenta?"Cantidad vendida (kg)":"Cantidad producida (kg)";
    valorInput.required=esGasto;cantidadInput.required=esProduccion||esVenta;precioVentaInput.required=esVenta;actualizarTotalVenta();
}
function establecerFechaActual(){document.getElementById("fecha").value=fechaActualLocal()}
function salirEdicion(){
    document.getElementById("editing-id").value="";document.getElementById("form-title").textContent="Agregar un movimiento";
    document.getElementById("edit-mode-label").classList.add("hidden");document.getElementById("cancel-edit").classList.add("hidden");
    document.getElementById("save-record").textContent="Guardar registro";
    formulario.reset();establecerFechaActual();actualizarCampos();
}
function iniciarEdicion(id){
    const r=registros.find(x=>String(x.id)===String(id));if(!r)return;
    mostrarPagina("registros");
    document.getElementById("editing-id").value=r.id;tipoSelect.value=r.tipo;
    document.getElementById("cultivo").value=r.cultivo||"";document.getElementById("descripcion").value=r.descripcion||"";
    document.getElementById("fecha").value=r.fecha||fechaActualLocal();categoriaInput.value=r.categoria||"Otros";
    valorInput.value=r.tipo==="gasto"?(Number(r.valor)||""):"";
    cantidadInput.value=(r.tipo==="produccion"||r.tipo==="venta")?(Number(r.cantidad)||""):"";
    precioVentaInput.value=r.tipo==="venta"?(Number(r.precioKg)||""):"";
    actualizarCampos();document.getElementById("form-title").textContent="Modificar movimiento";
    document.getElementById("edit-mode-label").classList.remove("hidden");document.getElementById("cancel-edit").classList.remove("hidden");
    document.getElementById("save-record").textContent="Guardar cambios";
    document.getElementById("record-form").scrollIntoView({behavior:"smooth",block:"start"});
}
tipoSelect.addEventListener("change",actualizarCampos);cantidadInput.addEventListener("input",actualizarTotalVenta);precioVentaInput.addEventListener("input",actualizarTotalVenta);
formulario.addEventListener("reset",()=>setTimeout(actualizarCampos,0));
document.getElementById("cancel-edit").addEventListener("click",salirEdicion);
document.getElementById("clear-form").addEventListener("click",()=>{if(document.getElementById("editing-id").value)salirEdicion()});
actualizarCampos();establecerFechaActual();

formulario.addEventListener("submit",e=>{
    e.preventDefault();
    const tipo=tipoSelect.value,cultivo=document.getElementById("cultivo").value.trim(),descripcion=document.getElementById("descripcion").value.trim(),fecha=document.getElementById("fecha").value;
    const valor=Number(valorInput.value),cantidad=Number(cantidadInput.value),precioKg=Number(precioVentaInput.value),categoria=categoriaInput.value;
    if(!cultivo||!descripcion||!fecha){alert("Completa todos los campos obligatorios.");return}
    if(tipo==="gasto"&&(!Number.isFinite(valor)||valor<=0)){alert("Ingresa un valor de gasto válido.");return}
    if((tipo==="produccion"||tipo==="venta")&&(!Number.isFinite(cantidad)||cantidad<=0)){alert("Ingresa una cantidad válida en kilogramos.");return}
    if(tipo==="venta"&&(!Number.isFinite(precioKg)||precioKg<=0)){alert("Ingresa un precio por kilogramo válido.");return}
    const id=document.getElementById("editing-id").value;
    const registro={id:id||Date.now().toString(),tipo,cultivo,descripcion,fecha,categoria:tipo==="gasto"?categoria:"",valor:tipo==="gasto"?valor:tipo==="venta"?cantidad*precioKg:0,cantidad:tipo==="produccion"||tipo==="venta"?cantidad:0,precioKg:tipo==="venta"?precioKg:0};
    if(id){const index=registros.findIndex(r=>String(r.id)===String(id));if(index>=0)registros[index]=registro;else registros.push(registro)}
    else registros.push(registro);
    guardarRegistros();actualizarInterfaz();salirEdicion();alert(id?"Registro actualizado correctamente.":"Registro guardado correctamente.");
});

// Acciones de editar y eliminar
document.getElementById("records-table").addEventListener("click",e=>{
    const editar=e.target.closest("[data-edit]"),eliminar=e.target.closest("[data-delete]");
    if(editar){iniciarEdicion(editar.dataset.edit);return}
    if(eliminar){const id=eliminar.dataset.delete;if(confirm("¿Deseas eliminar este registro?")){registros=registros.filter(r=>String(r.id)!==String(id));guardarRegistros();actualizarInterfaz();}}
});

// Filtros del historial
const filtrosElementos={"filter-search":"texto","filter-type":"tipo","filter-crop":"cultivo","filter-category":"categoria","filter-from":"desde","filter-to":"hasta","filter-sort":"orden"};
Object.entries(filtrosElementos).forEach(([id,clave])=>{
    const el=document.getElementById(id);el.addEventListener("input",()=>{filtros[clave]=el.value;actualizarTablaRegistros()});el.addEventListener("change",()=>{filtros[clave]=el.value;actualizarTablaRegistros()});
});
document.getElementById("clear-filters").addEventListener("click",()=>{
    Object.keys(filtros).forEach(k=>filtros[k]="");
    filtros.orden="date-desc";
    Object.entries(filtrosElementos).forEach(([id,k])=>document.getElementById(id).value=filtros[k]);
    actualizarTablaRegistros();
});

// Exportación CSV
document.getElementById("export-csv").addEventListener("click",()=>{
    if(!registros.length){alert("No hay registros para exportar.");return}
    const encabezados=["Fecha","Tipo","Cultivo","Descripción","Categoría","Valor COP","Cantidad kg","Precio por kg COP"];
    const filas=registros.map(r=>[r.fecha,r.tipo,r.cultivo,r.descripcion,r.categoria||"",Number(r.valor)||0,Number(r.cantidad)||0,Number(r.precioKg)||""]);
    const csv=[encabezados,...filas].map(f=>f.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="reporte_agroanalitica.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.getElementById("print-report").addEventListener("click",()=>{mostrarPagina("reportes");window.print()});
actualizarInterfaz();
