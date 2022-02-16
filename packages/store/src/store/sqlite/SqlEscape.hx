package helder.store.sqlite;

import haxe.Json;

private inline var BACKTICK = '`'.code;
private inline var SINGLE_QUOTE = "'".code;

function escape(v:Null<Any>): String {
  if (v == null) return 'null';
  if (v is Bool) return v ? '1' : '0';
  if (v is Int || v is Float) return '$v';
  if (v is String) return escapeString('$v');
  return 'json('+escapeString(Json.stringify(v))+')';
}

function escapeString(s: String) {
  var buf = new StringBuf();
  inline function tick()
    buf.addChar(SINGLE_QUOTE);
  tick();
  for (c in 0...s.length) 
    switch s.fastCodeAt(c) {
      case SINGLE_QUOTE: tick(); tick();
      case v: buf.addChar(v);
    }
  tick();
  return buf.toString();
}

function escapeId(s: String) {
  var buf = new StringBuf();
  inline function tick()
    buf.addChar(BACKTICK);
  tick();
  for (c in 0...s.length) 
    switch s.fastCodeAt(c) {
      case BACKTICK: tick(); tick();
      case v: buf.addChar(v);
    }
  tick();
  return buf.toString();
}