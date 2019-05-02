'use strict';

var working_directory="C:\\Users\\volumen\\"

const { spawn } = require( 'child_process' )
const tokenizer = require( 'string-tokenizer' )

const regexCommit = /commit ([a-z]|[A-Z]|[0-9]){40}/g
const regexAuthor = /\nAuthor: .*<.*>\n/g
const regexDate = /Date:   [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} ([-]|[+])?[0-9]{4}/g
const regexArchivoEliminado = / delete mode [0-9]{6} .*/g
const regexArchivoCreado = / create mode [0-9]{6} .*/g
const regexArchivoModificado = /[0-9]*\t[0-9]*\t.*/g

const listaDirectoriosAIgnorar = ["node_modules/","vendor/"]

const longitudSeparadorLog = 100

var ls
var commits=[]

try {
	var parametros = []
	parametros.push('log')
	parametros.push('--numstat')
	parametros.push('--no-merges')
	parametros.push('--since=2019-01-01')
	//parametros.push('--author=mcclone')
	parametros.push('--summary')
	parametros.push('--no-renames')
	parametros.push('--ignore-blank-lines')
	parametros.push('--ignore-all-space')
	parametros.push('--date=iso')
	ls = spawn( 'git', parametros, { cwd: working_directory } );
} catch(e) {
	console.log(e);
}

var buffer=""

ls.stdout.on( 'data', data => {
	console.log("leyendo")
	buffer+=data.toString()    
} );

ls.stderr.on( 'data', data => {
    console.log( `stderr: ${data}` );
} );

ls.on( 'close', code => {
	console.log('procesando')
	commits=analizarLog(buffer);
	console.log(commits.length+" commits procesados")
    // console.log(JSON.stringify(commits,null,2))
    console.log('buscando autores')
    var autores=extraerListaDeAutores(commits)
    console.log('contabilizando')
    autores.forEach(function(element,index,array){
    	console.log(element)
    	console.log(extraerEstadisticasPorAutor(commits,element))
    })    
} );

//--------------------------------------------------------------------------------------------------------------------------------------------

function analizarLog(log) {
	var pcommits=[]
	iniciarLog("ANALIZANDO LOG",'=')

	var salida = 
		tokenizer( log )
		.token('token_commit', regexCommit, function(tag,index,expr) { return( tag[0].substr(7,40)) } )
		.resolve(true)

	salida.token_commit = Array.isArray(salida.token_commit) ? salida.token_commit : [ salida.token_commit ]

	salida.token_commit.forEach(function(element,index,array){
		var cuerpoCommit = extraerCuerpoDeCommit(log,element.value)
		var commit = descomponerCuerpoCommit(cuerpoCommit)
		pcommits.push(commit)
	});

	cerrarLog('-');
	return(pcommits)
}

function iniciarLog(titulo,caracterApertura){
	titulo = ' '+titulo+' '
	console.log(caracterApertura.repeat(2)+titulo+caracterApertura.repeat(longitudSeparadorLog-titulo.length-2));
	console.group()
}

function cerrarLog(caracterCierre){
	console.groupEnd()
	console.log(caracterCierre.repeat(longitudSeparadorLog))
}

//--------------------------------------------------------------------------------------------------------------------------------------------

function extraerCuerpoDeCommit(log,commit){
	var inicio = log.indexOf("commit "+commit) + 48;
	var resultado_regex = regexCommit.exec(log.substr(inicio));
	var fin = resultado_regex == null ? log.length-1 : resultado_regex['index']+inicio;
	var cuerpo = log.substr(inicio-48,fin-inicio+48)
	logearExtraerCuerpoDeCommit(commit,inicio,fin,cuerpo)
	return(cuerpo);
}

function logearExtraerCuerpoDeCommit(commit,inicio,fin,cuerpo) {
	iniciarLog("COMMIT =>"+commit,'*')
	console.log("inicio: "+inicio)
	console.log("fin: "+fin)
	console.log("cuerpo:\n"+cuerpo);
	cerrarLog('·')
}

//--------------------------------------------------------------------------------------------------------------------------------------------

function descomponerCuerpoCommit(cuerpoCommit){
	var HashCommit = extraerHashCommit(cuerpoCommit)[0]
	var autor = extraerAutor(cuerpoCommit)[0]
	var fecha = interpretarFecha(extraerFecha(cuerpoCommit)[0])
	var archivosEliminados = extraerArchivosEliminados(cuerpoCommit)
	var archivosCreados = extraerArchivosCreados(cuerpoCommit).filter(element=>!archivoEnDirectorios(element,listaDirectoriosAIgnorar))
	var archivosModificados = extraerArchivosModificados(cuerpoCommit).filter(archivo=>!archivosEliminados.includes(archivo.nombreArchivo)&&!archivoEnDirectorios(archivo.nombreArchivo,listaDirectoriosAIgnorar))

	var dataCommit = {
		HashCommit,
		autor,
		fecha,
		archivosEliminados,
		archivosCreados,
		archivosModificados
	}
	logearDataCommit(dataCommit)
	return dataCommit
}

function archivoEnDirectorios(nombreArchivo,directorios){
	return directorios.some(function(element,index,array){
		return nombreArchivo.substr(0,element.length)==element
	})
}

function logearDataCommit(dataCommit){
	iniciarLog('DATA EXTRAIDA','+')
	console.log(dataCommit);
	cerrarLog('-')
}

function extraerHashCommit(log){
	return extraerValoresDeCoincidencias(
		regexCommit,
		log,
		(cadenaEncontrada)=>cadenaEncontrada.substr(7))
}

function extraerAutor(log){
	return extraerValoresDeCoincidencias(
		regexAuthor,
		log,
		(cadenaEncontrada)=>cadenaEncontrada.substr(9).replace('\n',''))
}

function extraerFecha(log){
	return extraerValoresDeCoincidencias(
		regexDate,
		log,
		(cadenaEncontrada)=>cadenaEncontrada.substr(8).replace('\n',''))
}

function interpretarFecha(cadenaFecha) {
	return new Date(cadenaFecha.substr(0,4)+"/"+cadenaFecha.substr(5,2)+"/"+cadenaFecha.substr(8,2))
}

function extraerArchivosEliminados(log) {
	return extraerValoresDeCoincidencias(
		regexArchivoEliminado,
		log,
		(cadenaEncontrada)=>cadenaEncontrada.substr(20)
	)
}

function extraerArchivosCreados(log) {
	return extraerValoresDeCoincidencias(
		regexArchivoCreado,
		log,
		(cadenaEncontrada)=>cadenaEncontrada.substr(20)
	)
}

function extraerArchivosModificados(log) {
	var resultados= extraerValoresDeCoincidencias(
		regexArchivoModificado,
		log,
		(cadenaEncontrada)=>{
			var valores = cadenaEncontrada.replace('\n','').split('\t')
			return {
				lineasAgregadas:Number(valores[0]),
				lineasEliminados:Number(valores[1]),
				nombreArchivo:valores[2]
			}
		}
	)
	
	return resultados.filter(archivo=>archivo.lineasAgregadas!=0 || archivo.lineasEliminados!=0)
}

function extraerValoresDeCoincidencias(regex,cadena,helper) {
	var resultados = []
	var resultado_regex
	regex.lastIndex = 0
	while((resultado_regex = regex.exec(cadena)) !== null) 
		resultados.push(helper(resultado_regex[0]))
	return resultados
}


//--------------------------------------------------------------------------------------------------------------------------------------------

function extraerEstadisticasPorAutor(commits,autor){
	var estadisticas={
		lineasAgregadas: 0
	}
	commits.forEach(function(element,index,array){
		if(element.autor.indexOf(autor)==-1) return
		estadisticas.lineasAgregadas+=sumarLineasCambiadas(element)
	})
	return estadisticas
}

function sumarLineasCambiadas(objetoCommit) {
	var total=0
	objetoCommit.archivosModificados.forEach(function(element,index,array){
		total+=element.lineasAgregadas
	})
	return total
}


function extraerListaDeAutores(commits){
	var autores=[]
	commits.forEach(function(element,index,array){
		if(!autores.includes(element.autor))
			autores.push(element.autor)
	})
	return autores
}