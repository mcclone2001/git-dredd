'use strict';

var working_directory="C:\\Users\\volumen\\"

const { spawn } = require( 'child_process' )
const tokenizer = require( 'string-tokenizer' )

const regexCommit = /commit ([a-z]|[A-Z]|[0-9]){40}/
const regexAuthor = /\nAuthor: .*<.*>\n/
const regexArchivoEliminado = / delete mode [0-9]{6} .*/g
const regexArchivoCreado = / create mode [0-9]{6} .*/g
const regexArchivoModificado = /[0-9]*\t[0-9]*\t.*\n/g

const longitudSeparadorLog = 100

var ls
var commits=[]

try {
	var parametros = []
	parametros.push('log')
	parametros.push('--numstat')
	parametros.push('--no-merges')
	parametros.push('--since=2019-03-01')
	parametros.push('--author=mcclone')
	parametros.push('--summary')
	parametros.push('--no-renames')
	parametros.push('--ignore-blank-lines')
	parametros.push('--ignore-all-space')
	ls = spawn( 'git', parametros, { cwd: working_directory } );
} catch(e) {
	console.log(e);
}
    

ls.stdout.on( 'data', data => {
    analizarLog(`${data}`);
} );

ls.stderr.on( 'data', data => {
    console.log( `stderr: ${data}` );
} );

ls.on( 'close', code => {
    console.log( `child process exited with code ${code}` );
} );

function analizarLog(log) {
	iniciarLog("ANALIZANDO LOG",'=')

	var salida = 
		tokenizer( log )
		.token('token_commit', regexCommit, function(tag,index,expr) { return( tag[0].substr(7,40)) } )
		.resolve(true)

	salida.token_commit = Array.isArray(salida.token_commit) ? salida.token_commit : [ salida.token_commit ]

	salida.token_commit.forEach(function(element,index,array){
		var cuerpoCommit = extraerCuerpoDeCommit(log,element.value)
		var commit = descomponerCuerpoCommit(cuerpoCommit)
		commits.push(commit)
	});

	cerrarLog('-');
	console.log(commits)
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

function extraerCuerpoDeCommit(log,commit){
	var inicio = log.indexOf("commit "+commit) + 48;
	var resultado_regex=regexCommit.exec(log.substr(inicio));
	var fin = resultado_regex == null ? log.length-1 : resultado_regex['index']+inicio;
	var cuerpo=log.substr(inicio-48,fin-inicio+48)
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

function descomponerCuerpoCommit(cuerpoCommit){
	var archivosEliminados = extraerArchivosEliminados(cuerpoCommit)
	var archivosCreados = extraerArchivosCreados(cuerpoCommit)
	var archivosModificados = extraerArchivosModificados(cuerpoCommit).filter(archivo=>!archivosEliminados.includes(archivo.nombreArchivo))

	var dataCommit = {
		archivosEliminados,
		archivosCreados,
		archivosModificados
	}
	logearDataCommit(dataCommit)
	return dataCommit
}

function logearDataCommit(dataCommit){
	iniciarLog('DATA EXTRAIDA','+')
	console.log(dataCommit);
	cerrarLog('-')
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
				lineasAgregadas:valores[0],
				lineasEliminados:valores[1],
				nombreArchivo:valores[2]
			}
		}
	)
	
	return resultados.filter(archivo=>archivo.lineasAgregadas!=0 || archivo.lineasEliminados!=0)
}

function extraerValoresDeCoincidencias(regex,cadena,helper) {
	var resultados = []
	var resultado_regex
	while((resultado_regex = regex.exec(cadena)) !== null) 
		resultados.push(helper(resultado_regex[0]))
	return resultados
}