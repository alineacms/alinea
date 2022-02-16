package helder.store.sqlite;

import helder.store.Expression.EV;
import helder.store.Expression.toExpr;

@:expose
class Functions {
  public static function castAs(x:EV<Dynamic>, type:String) {
    return new Expression(Call('cast', [toExpr(x), toExpr(type)]));
  }

  // =====================================================
  // https://www.sqlite.org/lang_corefunc.html
  // =====================================================

  /** The abs(X) function returns the absolute value of the numeric argument X. Abs(X) returns NULL if X is NULL. Abs(X) returns 0.0 if X is a string or blob that cannot be converted to a numeric value. If X is the integer -9223372036854775808 then abs(X) throws an integer overflow error since there is no equivalent positive 64-bit two complement value.*/
  public static function abs(x:EV<Float>):Expression<Float> {
    return new Expression(Call('abs', [toExpr(x)]));
  }

  /** The changes() function returns the number of database rows that were changed or inserted or deleted by the most recently completed INSERT, DELETE, or UPDATE statement, exclusive of statements in lower-level triggers. The changes() SQL function is a wrapper around the sqlite3_changes() C/C++ function and hence follows the same rules for counting changes.*/
  public static function changes():Expression<Int> {
    return new Expression(Call('changes', []));
  }

  /** The char(X1,X2,...,XN) function returns a string composed of characters having the unicode code point values of integers X1 through XN, respectively.*/
  public static function char(...arg:EV<Int>):Expression<String> {
    return new Expression(Call('char', [for (x in arg) toExpr(x)]));
  }

  /** The coalesce() function returns a copy of its first non-NULL argument, or NULL if all arguments are NULL. Coalesce() must have at least 2 arguments.*/
  public static function coalesce(x:EV<Dynamic>, y:EV<Dynamic>, ...rest:EV<Dynamic>):Expression<Dynamic> {
    return new Expression(Call('coalesce', [toExpr(x), toExpr(y)].concat([for (x in rest) toExpr(x)])));
  }

  /** The hex() function interprets its argument as a BLOB and returns a string which is the upper-case hexadecimal rendering of the content of that blob. If the argument X in "hex(X)" is an integer or floating point number, then "interprets its argument as a BLOB" means that the binary number is first converted into a UTF8 text representation, then that text is interpreted as a BLOB. Hence, "hex(12345678)" renders as "3132333435363738" not the binary representation of the integer value "0000000000BC614E".*/
  // public static function hex(x:EV<Bytes>): Expression<String> {
  //  return new Expression(Call('hex', [expr(x)]));
  // }

  /** The ifnull() function returns a copy of its first non-NULL argument, or NULL if both arguments are NULL. Ifnull() must have exactly 2 arguments. The ifnull() function is equivalent to coalesce() with two arguments.*/
  public static function ifnull<T>(x:EV<T>, y:EV<T>):Expression<T> {
    return new Expression(Call('ifnull', [toExpr(x), toExpr(y)]));
  }

  /** The iif(X,Y,Z) function returns the value Y if X is true, and Z otherwise. The iif(X,Y,Z) function is logically equivalent to and generates the same bytecode as the CASE expression "CASE WHEN X THEN Y ELSE Z END".*/
  public static function iif<T>(x:EV<Bool>, y:EV<T>, z:EV<T>):Expression<T> {
    return new Expression(Call('iif', [toExpr(x), toExpr(y), toExpr(z)]));
  }

  /** The instr(X,Y) function finds the first occurrence of string Y within string X and returns the number of prior characters plus 1, or 0 if Y is nowhere found within X. Or, if X and Y are both BLOBs, then instr(X,Y) returns one more than the number bytes prior to the first occurrence of Y, or 0 if Y does not occur anywhere within X. If both arguments X and Y to instr(X,Y) are non-NULL and are not BLOBs then both are interpreted as strings. If either X or Y are NULL in instr(X,Y) then the result is NULL.*/
  public static function instr(x:EV<String>, y:EV<String>):Expression<Int> {
    return new Expression(Call('instr', [toExpr(x), toExpr(y)]));
  }

  /** The last_insert_rowid() function returns the ROWID of the last row insert from the database connection which invoked the function. The last_insert_rowid() SQL function is a wrapper around the sqlite3_last_insert_rowid() C/C++ interface function.*/
  public static function last_insert_rowid():Expression<Int> {
    return new Expression(Call('last_insert_rowid', []));
  }

  /** For a string value X, the length(X) function returns the number of characters (not bytes) in X prior to the first NUL character. Since SQLite strings do not normally contain NUL characters, the length(X) function will usually return the total number of characters in the string X. For a blob value X, length(X) returns the number of bytes in the blob. If X is NULL then length(X) is NULL. If X is numeric then length(X) returns the length of a string representation of X.*/
  @:native('strLength') 
  public static function length(x:EV<String>):Expression<Int> {
    return new Expression(Call('length', [toExpr(x)]));
  }

  /** The likelihood(X,Y) function returns argument X unchanged. The value Y in likelihood(X,Y) must be a floating point constant between 0.0 and 1.0, inclusive. The likelihood(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles during run-time (that is, during calls to sqlite3_step()). The purpose of the likelihood(X,Y) function is to provide a hint to the query planner that the argument X is a boolean that is true with a probability of approximately Y. The unlikely(X) function is short-hand for likelihood(X,0.0625). The likely(X) function is short-hand for likelihood(X,0.9375).*/
  public static function likelihood(x:EV<Bool>, y:Float):Expression<Bool> {
    return new Expression(Call('likelihood', [toExpr(x), toExpr(y)]));
  }

  /** The likely(X) function returns the argument X unchanged. The likely(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles at run-time (that is, during calls to sqlite3_step()). The purpose of the likely(X) function is to provide a hint to the query planner that the argument X is a boolean value that is usually true. The likely(X) function is equivalent to likelihood(X,0.9375). See also: unlikely(X).*/
  public static function likely(x:EV<Bool>):Expression<Bool> {
    return new Expression(Call('likely', [toExpr(x)]));
  }

  /** The lower(X) function returns a copy of string X with all ASCII characters converted to lower case. The default built-in lower() function works for ASCII characters only. To do case conversions on non-ASCII characters, load the ICU extension.*/
  public static function lower(x:EV<String>):Expression<String> {
    return new Expression(Call('lower', [toExpr(x)]));
  }

  /** The ltrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the left side of X. If the Y argument is omitted, ltrim(X) removes spaces from the left side of X.**/
  public static function ltrim(x:EV<String>, ?y:EV<String>):Expression<String> {
    return new Expression(Call('ltrim', [toExpr(x), toExpr(y)]));
  }

  /** The multi-argument max() function returns the argument with the maximum value, or return NULL if any argument is NULL. The multi-argument max() function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If none of the arguments to max() define a collating function, then the BINARY collating function is used. Note that max() is a simple function when it has 2 or more arguments but operates as an aggregate function if given only a single argument.*/
  public static function max<T>(x:EV<T>, y:EV<T>, ...rest:EV<T>):Expression<T> {
    return new Expression(Call('max', [toExpr(x), toExpr(y)].concat([for (x in rest) toExpr(x)])));
  }

  /** The multi-argument min() function returns the argument with the minimum value. The multi-argument min() function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If none of the arguments to min() define a collating function, then the BINARY collating function is used. Note that min() is a simple function when it has 2 or more arguments but operates as an aggregate function if given only a single argument.*/
  public static function min<T>(x:EV<T>, y:EV<T>, ...rest:EV<T>):Expression<T> {
    return new Expression(Call('min', [toExpr(x), toExpr(y)].concat([for (x in rest) toExpr(x)])));
  }

  /** The nullif(X,Y) function returns its first argument if the arguments are different and NULL if the arguments are the same. The nullif(X,Y) function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If neither argument to nullif() defines a collating function then the BINARY is used.*/
  public static function nullif<T>(x:EV<T>, y:EV<T>):Expression<Null<T>> {
    return new Expression(Call('nullif', [toExpr(x), toExpr(y)]));
  }

  /** The printf(FORMAT,...) SQL function works like the sqlite3_mprintf() C-language function and the printf() function from the standard C library. The first argument is a format string that specifies how to construct the output string using values taken from subsequent arguments. If the FORMAT argument is missing or NULL then the result is NULL. The %n format is silently ignored and does not consume an argument. The %p format is an alias for %X. The %z format is interchangeable with %s. If there are too few arguments in the argument list, missing arguments are assumed to have a NULL value, which is translated into 0 or 0.0 for numeric formats or an empty string for %s. See the built-in printf() documentation for additional information.*/
  public static function printf(format:String, ...rest:Expression<Dynamic>):Expression<String> {
    return new Expression(Call('printf', [toExpr(format)].concat([for (x in rest) toExpr(x)])));
  }

  /** The quote(X) function returns the text of an SQL literal which is the value of its argument suitable for inclusion into an SQL statement. Strings are surrounded by single-quotes with escapes on interior quotes as needed. BLOBs are encoded as hexadecimal literals. Strings with embedded NUL characters cannot be represented as string literals in SQL and hence the returned string literal is truncated prior to the first NUL.*/
  public static function quote(x:EV<String>):Expression<String> {
    return new Expression(Call('quote', [toExpr(x)]));
  }

  /** The random() function returns a pseudo-random integer between -9223372036854775808 and +9223372036854775807.*/
  public static function random():Expression<Float> {
    return new Expression(Call('random', []));
  }

  /** The randomblob(N) function return an N-byte blob containing pseudo-random bytes. If N is less than 1 then a 1-byte random blob is returned.*/
  // public static function randomblob(x:EV<X>): Expression<X> {
  //  return new Expression(Call('randomblob', [expr(x)]));
  // }

  /** The replace(X,Y,Z) function returns a string formed by substituting string Z for every occurrence of string Y in string X. The BINARY collating sequence is used for comparisons. If Y is an empty string then return X unchanged. If Z is not initially a string, it is cast to a UTF-8 string prior to processing.*/
  public static function replace(x:EV<String>, y:EV<String>, z:EV<String>):Expression<String> {
    return new Expression(Call('replace', [toExpr(x), toExpr(y), toExpr(z)]));
  }

  /** The round(X,Y) function returns a floating-point value X rounded to Y digits to the right of the decimal point. If the Y argument is omitted, it is assumed to be 0.*/
  public static function round(x:EV<Float>, ?y:EV<Int>):Expression<Float> {
    return new Expression(Call('round', [toExpr(x), toExpr(y)]));
  }

  /** The rtrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the right side of X. If the Y argument is omitted, rtrim(X) removes spaces from the right side of X.*/
  public static function rtrim(x:EV<String>, ?y:EV<String>):Expression<String> {
    return new Expression(Call('rtrim', [toExpr(x), toExpr(y)]));
  }

  /** The sign(X) function returns -1, 0, or +1 if the argument X is a numeric value that is negative, zero, or positive, respectively. If the argument to sign(X) is NULL or is a string or blob that cannot be losslessly converted into a number, then sign(X) return NULL.*/
  public static function sign(x:EV<Float>):Expression<Int> {
    return new Expression(Call('sign', [toExpr(x)]));
  }

  /** The soundex(X) function returns a string that is the soundex encoding of the string X. The string "?000" is returned if the argument is NULL or contains no ASCII alphabetic characters. This function is omitted from SQLite by default. It is only available if the SQLITE_SOUNDEX compile-time option is used when SQLite is built.*/
  public static function soundex(x:EV<String>):Expression<String> {
    return new Expression(Call('soundex', [toExpr(x)]));
  }

  /** The sqlite_version() function returns the version string for the SQLite library that is running. This function is an SQL wrapper around the sqlite3_libversion() C-interface.*/
  public static function sqlite_version():Expression<String> {
    return new Expression(Call('sqlite_version', []));
  }

  /** The substr(X,Y,Z) function returns a substring of input string X that begins with the Y-th character and which is Z characters long. If Z is omitted then substr(X,Y) returns all characters through the end of the string X beginning with the Y-th. The left-most character of X is number 1. If Y is negative then the first character of the substring is found by counting from the right rather than the left. If Z is negative then the abs(Z) characters preceding the Y-th character are returned. If X is a string then characters indices refer to actual UTF-8 characters. If X is a BLOB then the indices refer to bytes.*/
  public static function substr(x:EV<String>, y:EV<Int>, ?z:EV<Int>):Expression<String> {
    return new Expression(Call('substr', [toExpr(x), toExpr(y), toExpr(z)]));
  }

  /** The total_changes() function returns the number of row changes caused by INSERT, UPDATE or DELETE statements since the current database connection was opened. This function is a wrapper around the sqlite3_total_changes() C/C++ interface.*/
  public static function total_changes():Expression<Int> {
    return new Expression(Call('total_changes', []));
  }

  /** The trim(X,Y) function returns a string formed by removing any and all characters that appear in Y from both ends of X. If the Y argument is omitted, trim(X) removes spaces from both ends of X.*/
  public static function trim(x:EV<String>, Y:EV<String>):Expression<String> {
    return new Expression(Call('trim', [toExpr(x)]));
  }

  /** The typeof(X) function returns a string that indicates the datatype of the expression X: "null", "integer", "real", "text", or "blob".*/
  public static function typeof(x:EV<Dynamic>):Expression<String> {
    return new Expression(Call('typeof', [toExpr(x)]));
  }

  /** The unicode(X) function returns the numeric unicode code point corresponding to the first character of the string X. If the argument to unicode(X) is not a string then the result is undefined.*/
  public static function unicode(x:EV<String>):Expression<Int> {
    return new Expression(Call('unicode', [toExpr(x)]));
  }

  /** The unlikely(X) function returns the argument X unchanged. The unlikely(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles at run-time (that is, during calls to sqlite3_step()). The purpose of the unlikely(X) function is to provide a hint to the query planner that the argument X is a boolean value that is usually not true. The unlikely(X) function is equivalent to likelihood(X, 0.0625).*/
  public static function unlikely(x:EV<Bool>):Expression<Bool> {
    return new Expression(Call('unlikely', [toExpr(x)]));
  }

  /** The upper(X) function returns a copy of input string X in which all lower-case ASCII characters are converted to their upper-case equivalent.*/
  public static function upper(x:EV<String>):Expression<String> {
    return new Expression(Call('upper', [toExpr(x)]));
  }

  /** The zeroblob(N) function returns a BLOB consisting of N bytes of 0x00. SQLite manages these zeroblobs very efficiently. Zeroblobs can be used to reserve space for a BLOB that is later written using incremental BLOB I/O. This SQL function is implemented using the sqlite3_result_zeroblob() routine from the C/C++ interface.*/
  // public static function zeroblob(x:EV<X>): Expression<X> {
  //  return new Expression(Call('zeroblob', [expr(x)]));
  // }
  // =====================================================
  // http://www.sqlite.org/lang_aggfunc.html
  // =====================================================

  /** The avg() function returns the average value of all non-NULL X within a group. String and BLOB values that do not look like numbers are interpreted as 0. The result of avg() is always a floating point value as long as at there is at least one non-NULL input even if all inputs are integers. The result of avg() is NULL if and only if there are no non-NULL inputs. */
  public static function avg(x:Expression<Float>):Expression<Float> {
    return new Expression(Call('avg', [toExpr(x)]));
  }

  /** The count(X) function returns a count of the number of times that X is not NULL in a group. The count(*) function (with no arguments) returns the total number of rows in the group. */
  public static function count(?x:Expression<Dynamic>):Expression<Int> {
    final params = if ((x: Null<Dynamic>) == null) [] else [toExpr(x)];
    return new Expression(Call('count', params));
  }

  /** The group_concat() function returns a string which is the concatenation of all non-NULL values of X. If parameter Y is present then it is used as the separator between instances of X. A comma (",") is used as the separator if Y is omitted. The order of the concatenated elements is arbitrary. */
  public static function group_concat(x:EV<String>, y:EV<String>):Expression<String> {
    return new Expression(Call('group_concat', [toExpr(x), toExpr(y)]));
  }

  /** The sum() and total() aggregate functions return sum of all non-NULL values in the group. If there are no non-NULL input rows then sum() returns NULL but total() returns 0.0. NULL is not normally a helpful result for the sum of no rows but the SQL standard requires it and most other SQL database engines implement sum() that way so SQLite does it in the same way in order to be compatible. The non-standard total() function is provided as a convenient way to work around this design problem in the SQL language. 

    The result of total() is always a floating point value. The result of sum() is an integer value if all non-NULL inputs are integers. If any input to sum() is neither an integer or a NULL then sum() returns a floating point value which might be an approximation to the true sum.

    Sum() will throw an "integer overflow" exception if all inputs are integers or NULL and an integer overflow occurs at any point during the computation. Total() never throws an integer overflow.
   */
  public static function sum(x:EV<Float>):Expression<Float> {
    return new Expression(Call('sum', [toExpr(x)]));
  }

  // =====================================================
  // http://www.sqlite.org/lang_mathfunc.html
  // =====================================================

  /** Return the arccosine of X. The result is in radians. */
  public static function acos(x:EV<Float>):Expression<Float> {
    return new Expression(Call('acos', [toExpr(x)]));
  }

  /** Return the hyperbolic arccosine of X. */
  public static function acosh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('acosh', [toExpr(x)]));
  }

  /** Return the arcsine of X. The result is in radians. */
  public static function asin(x:EV<Float>):Expression<Float> {
    return new Expression(Call('asin', [toExpr(x)]));
  }

  /** Return the hyperbolic arcsine of X. */
  public static function asinh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('asinh', [toExpr(x)]));
  }

  /** Return the arctangent of X. The result is in radians. */
  public static function atan(x:EV<Float>):Expression<Float> {
    return new Expression(Call('atan', [toExpr(x)]));
  }

  /** Return the arctangent of Y/X. The result is in radians. The result is placed into correct quadrant depending on the signs of X and Y. */
  public static function atan2(x:EV<Float>, y:EV<Float>):Expression<Float> {
    return new Expression(Call('atan2', [toExpr(x), toExpr(y)]));
  }

  /** Return the hyperbolic arctangent of X. */
  public static function atanh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('atanh', [toExpr(x)]));
  }

  /** Return the first representable integer value greater than or equal to X. For positive values of X, this routine rounds away from zero. For negative values of X, this routine rounds toward zero. */
  public static function ceil(x:EV<Float>):Expression<Float> {
    return new Expression(Call('ceil', [toExpr(x)]));
  }

  /** Return the cosine of X. X is in radians. */
  public static function cos(x:EV<Float>):Expression<Float> {
    return new Expression(Call('cos', [toExpr(x)]));
  }

  /** Return the hyperbolic cosine of X. */
  public static function cosh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('cosh', [toExpr(x)]));
  }

  /** Convert value X from radians into degrees. */
  public static function degrees(x:EV<Float>):Expression<Float> {
    return new Expression(Call('degrees', [toExpr(x)]));
  }

  /** Compute e (Euler's number, approximately 2.71828182845905) raised to the power X. */
  public static function exp(x:EV<Float>):Expression<Float> {
    return new Expression(Call('exp', [toExpr(x)]));
  }

  /** Return the first representable integer value less than or equal to X. For positive numbers, this function rounds toward zero. For negative numbers, this function rounds away from zero. */
  public static function floor(x:EV<Float>):Expression<Float> {
    return new Expression(Call('floor', [toExpr(x)]));
  }

  /** Return the natural logarithm of X. */
  public static function ln(x:EV<Float>):Expression<Float> {
    return new Expression(Call('ln', [toExpr(x)]));
  }

  /** 
    Return the base-10 logarithm for X. Or, for the two-argument version, return the base-B logarithm of X.
    Compatibility note: SQLite works like PostgreSQL in that the log() function computes a base-10 logarithm. Most other SQL database engines compute a natural logarithm for log(). In the two-argument version of log(B,X), the first argument is the base and the second argument is the operand. This is the same as in PostgreSQL and MySQL, but is reversed from SQL Server which uses the second argument as the base and the first argument as the operand.
   */
  // TODO: log10(X) overload: log(B,X)
  public static function log(x:EV<Float>, ?y: EV<Float>):Expression<Float> {
    return new Expression(Call('log', [toExpr(x), toExpr(y)]));
  }

  /** Return the logarithm base-2 for the number X. */
  public static function log2(x:EV<Float>):Expression<Float> {
    return new Expression(Call('log2', [toExpr(x)]));
  }

  /** Return the remainder after dividing X by Y. This is similar to the '%' operator, except that it works for non-integer arguments. */
  public static function mod(x:EV<Float>, y:EV<Float>):Expression<Float> {
    return new Expression(Call('mod', [toExpr(x)]));
  }

  /** Return an approximation for π. */
  public static function pi(x:EV<Float>):Expression<Float> {
    return new Expression(Call('pi', [toExpr(x)]));
  }

  /** Compute X raised to the power Y. */
  public static function pow(x:EV<Float>, y:EV<Float>):Expression<Float> {
    return new Expression(Call('pow', [toExpr(x)]));
  }

  /** Convert X from degrees into radians. */
  public static function radians(x:EV<Float>):Expression<Float> {
    return new Expression(Call('radians', [toExpr(x)]));
  }

  /** Return the sine of X. X is in radians. */
  public static function sin(x:EV<Float>):Expression<Float> {
    return new Expression(Call('sin', [toExpr(x)]));
  }

  /** Return the hyperbolic sine of X. */
  public static function sinh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('sinh', [toExpr(x)]));
  }

  /** Return the square root of X. NULL is returned if X is negative. */
  public static function sqrt(x:EV<Float>):Expression<Float> {
    return new Expression(Call('sqrt', [toExpr(x)]));
  }

  /** Return the tangent of X. X is in radians. */
  public static function tan(x:EV<Float>):Expression<Float> {
    return new Expression(Call('tan', [toExpr(x)]));
  }

  /** Return the hyperbolic tangent of X. */
  public static function tanh(x:EV<Float>):Expression<Float> {
    return new Expression(Call('tanh', [toExpr(x)]));
  }

  /** Return the representable integer in between X and 0 (inclusive) that is furthest away from zero. Or, in other words, return the integer part of X, rounding toward zero. The trunc() function is similar to ceiling(X) and floor(X) except that it always rounds toward zero whereas ceiling(X) and floor(X) round up and down, respectively. */
  public static function trunc(x:EV<Float>):Expression<Float> {
    return new Expression(Call('trunc', [toExpr(x)]));
  }

  // =====================================================
  // https://www.sqlite.org/lang_datefunc.html
  // =====================================================
  public static function date(timeValue:EV<Dynamic>, ...rest:EV<String>):Expression<String> {
    return new Expression(Call('date', [toExpr(timeValue)].concat([for (x in rest) toExpr(x)])));
  }

  public static function time(timeValue:EV<Dynamic>, ...rest:EV<String>):Expression<String> {
    return new Expression(Call('time', [toExpr(timeValue)].concat([for (x in rest) toExpr(x)])));
  }

  public static function datetime(timeValue:EV<Dynamic>, ...rest:EV<String>):Expression<String> {
    return new Expression(Call('datetime', [toExpr(timeValue)].concat([for (x in rest) toExpr(x)])));
  }

  public static function julianday(timeValue:EV<Dynamic>, ...rest:EV<String>):Expression<String> {
    return new Expression(Call('julianday', [toExpr(timeValue)].concat([for (x in rest) toExpr(x)])));
  }

  public static function strftime(format:EV<String>, timeValue:EV<Dynamic>, ...rest:EV<String>):Expression<String> {
    return new Expression(Call('strftime', [toExpr(format), toExpr(timeValue)].concat([for (x in rest) toExpr(x)])));
  }
}
