import {EV, Expr} from '../Expr'
import {Functions} from '../Functions'

export const SqliteFunctions = Functions as SqliteFunctions

export type SqliteFunctions = {
  arrayLength(x: EV<Array<any>>): Expr<number>
  cast(x: EV<any>, type: 'text'): Expr<string>
  cast(x: EV<any>, type: 'real'): Expr<number>
  cast(x: EV<any>, type: 'integer'): Expr<number>
  cast(x: EV<any>, type: 'numeric'): Expr<number>

  // =====================================================
  // https://www.sqlite.org/lang_corefunc.html
  // =====================================================

  /** The abs(X) function returns the absolute value of the numeric argument X. Abs(X) returns NULL if X is NULL. Abs(X) returns 0.0 if X is a string or blob that cannot be converted to a numeric value. If X is the numbereger -9223372036854775808 then abs(X) throws an numbereger overflow error since there is no equivalent positive 64-bit two complement value.*/
  abs(x: EV<number>): Expr<number>

  /** The changes() function returns the number of database rows that were changed or inserted or deleted by the most recently completed INSERT, DELETE, or UPDATE statement, exclusive of statements in lower-level triggers. The changes() SQL function is a wrapper around the sqlite3_changes() C/C++ function and hence follows the same rules for counting changes.*/
  changes(): Expr<number>

  /** The char(X1,X2,...,XN) function returns a string composed of characters having the unicode code ponumber values of numberegers X1 through XN, respectively.*/
  char(...arg: Array<EV<number>>): Expr<string>

  /** The coalesce() function returns a copy of its first non-NULL argument, or NULL if all arguments are NULL. Coalesce() must have at least 2 arguments.*/
  coalesce(x: EV<any>, y: EV<any>, ...rest: EV<any>): Expr<any>

  /** The hex() function numbererprets its argument as a BLOB and returns a string which is the upper-case hexadecimal rendering of the content of that blob. If the argument X in "hex(X)" is an numbereger or numbering ponumber number, then "numbererprets its argument as a BLOB" means that the binary number is first converted numbero a UTF8 text representation, then that text is numbererpreted as a BLOB. Hence, "hex(12345678)" renders as "3132333435363738" not the binary representation of the numbereger value "0000000000BC614E".*/
  // hex(x:EV<Bytes>): Expr<string> {
  //  return new Expr(Call('hex', [expr(x)]));
  // }

  /** The ifnull() function returns a copy of its first non-NULL argument, or NULL if both arguments are NULL. Ifnull() must have exactly 2 arguments. The ifnull() function is equivalent to coalesce() with two arguments.*/
  ifnull<T>(x: EV<T>, y: EV<T>): Expr<T>

  /** The iif(X,Y,Z) function returns the value Y if X is true, and Z otherwise. The iif(X,Y,Z) function is logically equivalent to and generates the same bytecode as the CASE Expr "CASE WHEN X THEN Y ELSE Z END".*/
  iif<T>(x: EV<boolean>, y: EV<T>, z: EV<T>): Expr<T>

  /** The instr(X,Y) function finds the first occurrence of string Y within string X and returns the number of prior characters plus 1, or 0 if Y is nowhere found within X. Or, if X and Y are both BLOBs, then instr(X,Y) returns one more than the number bytes prior to the first occurrence of Y, or 0 if Y does not occur anywhere within X. If both arguments X and Y to instr(X,Y) are non-NULL and are not BLOBs then both are numbererpreted as strings. If either X or Y are NULL in instr(X,Y) then the result is NULL.*/
  instr(x: EV<string>, y: EV<string>): Expr<number>

  /** The last_insert_rowid() function returns the ROWID of the last row insert from the database connection which invoked the function. The last_insert_rowid() SQL function is a wrapper around the sqlite3_last_insert_rowid() C/C++ numbererface function.*/
  last_insert_rowid(): Expr<number>

  /** For a string value X, the length(X) function returns the number of characters (not bytes) in X prior to the first NUL character. Since SQLite strings do not normally contain NUL characters, the length(X) function will usually return the total number of characters in the string X. For a blob value X, length(X) returns the number of bytes in the blob. If X is NULL then length(X) is NULL. If X is numeric then length(X) returns the length of a string representation of X.*/

  length(x: EV<string>): Expr<number>

  /** The likelihood(X,Y) function returns argument X unchanged. The value Y in likelihood(X,Y) must be a numbering ponumber constant between 0.0 and 1.0, inclusive. The likelihood(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles during run-time (that is, during calls to sqlite3_step()). The purpose of the likelihood(X,Y) function is to provide a hnumber to the query planner that the argument X is a boolean that is true with a probability of approximately Y. The unlikely(X) function is short-hand for likelihood(X,0.0625). The likely(X) function is short-hand for likelihood(X,0.9375).*/
  likelihood(x: EV<boolean>, y: number): Expr<boolean>

  /** The likely(X) function returns the argument X unchanged. The likely(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles at run-time (that is, during calls to sqlite3_step()). The purpose of the likely(X) function is to provide a hnumber to the query planner that the argument X is a boolean value that is usually true. The likely(X) function is equivalent to likelihood(X,0.9375). See also: unlikely(X).*/
  likely(x: EV<boolean>): Expr<boolean>

  /** The lower(X) function returns a copy of string X with all ASCII characters converted to lower case. The default built-in lower() function works for ASCII characters only. To do case conversions on non-ASCII characters, load the ICU extension.*/
  lower(x: EV<string>): Expr<string>

  /** The ltrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the left side of X. If the Y argument is omitted, ltrim(X) removes spaces from the left side of X.**/
  ltrim(x: EV<string>, y?: EV<string>): Expr<string>

  /** The multi-argument max() function returns the argument with the maximum value, or return NULL if any argument is NULL. The multi-argument max() function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If none of the arguments to max() define a collating function, then the BINARY collating function is used. Note that max() is a simple function when it has 2 or more arguments but operates as an aggregate function if given only a single argument.*/
  max<T>(x: EV<T>, y: EV<T>, ...rest: Array<EV<T>>): Expr<T>

  /** The multi-argument min() function returns the argument with the minimum value. The multi-argument min() function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If none of the arguments to min() define a collating function, then the BINARY collating function is used. Note that min() is a simple function when it has 2 or more arguments but operates as an aggregate function if given only a single argument.*/
  min<T>(x: EV<T>, y: EV<T>, ...rest: Array<EV<T>>): Expr<T>

  /** The nullif(X,Y) function returns its first argument if the arguments are different and NULL if the arguments are the same. The nullif(X,Y) function searches its arguments from left to right for an argument that defines a collating function and uses that collating function for all string comparisons. If neither argument to nullif() defines a collating function then the BINARY is used.*/
  nullif<T>(x: EV<T>, y: EV<T>): Expr<T | null>

  /** The prnumberf(FORMAT,...) SQL function works like the sqlite3_mprnumberf() C-language function and the prnumberf() function from the standard C library. The first argument is a format string that specifies how to construct the output string using values taken from subsequent arguments. If the FORMAT argument is missing or NULL then the result is NULL. The %n format is silently ignored and does not consume an argument. The %p format is an alias for %X. The %z format is numbererchangeable with %s. If there are too few arguments in the argument list, missing arguments are assumed to have a NULL value, which is translated numbero 0 or 0.0 for numeric formats or an empty string for %s. See the built-in prnumberf() documentation for additional information.*/
  prnumberf(format: string, ...rest: Array<Expr<any>>): Expr<string>

  /** The quote(X) function returns the text of an SQL literal which is the value of its argument suitable for inclusion numbero an SQL statement. strings are surrounded by single-quotes with escapes on numbererior quotes as needed. BLOBs are encoded as hexadecimal literals. strings with embedded NUL characters cannot be represented as string literals in SQL and hence the returned string literal is truncated prior to the first NUL.*/
  quote(x: EV<string>): Expr<string>

  /** The random() function returns a pseudo-random numbereger between -9223372036854775808 and +9223372036854775807.*/
  random(): Expr<number>

  /** The randomblob(N) function return an N-byte blob containing pseudo-random bytes. If N is less than 1 then a 1-byte random blob is returned.*/
  // randomblob(x:EV<X>): Expr<X> {
  //  return new Expr(Call('randomblob', [expr(x)]));
  // }

  /** The replace(X,Y,Z) function returns a string formed by substituting string Z for every occurrence of string Y in string X. The BINARY collating sequence is used for comparisons. If Y is an empty string then return X unchanged. If Z is not initially a string, it is cast to a UTF-8 string prior to processing.*/
  replace(x: EV<string>, y: EV<string>, z: EV<string>): Expr<string>

  /** The round(X,Y) function returns a numbering-ponumber value X rounded to Y digits to the right of the decimal ponumber. If the Y argument is omitted, it is assumed to be 0.*/
  round(x: EV<number>, y?: EV<number>): Expr<number>

  /** The rtrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the right side of X. If the Y argument is omitted, rtrim(X) removes spaces from the right side of X.*/
  rtrim(x: EV<string>, y?: EV<string>): Expr<string>

  /** The sign(X) function returns -1, 0, or +1 if the argument X is a numeric value that is negative, zero, or positive, respectively. If the argument to sign(X) is NULL or is a string or blob that cannot be losslessly converted numbero a number, then sign(X) return NULL.*/
  sign(x: EV<number>): Expr<number>

  /** The soundex(X) function returns a string that is the soundex encoding of the string X. The string "?000" is returned if the argument is NULL or contains no ASCII alphabetic characters. This function is omitted from SQLite by default. It is only available if the SQLITE_SOUNDEX compile-time option is used when SQLite is built.*/
  soundex(x: EV<string>): Expr<string>

  /** The sqlite_version() function returns the version string for the SQLite library that is running. This function is an SQL wrapper around the sqlite3_libversion() C-numbererface.*/
  sqlite_version(): Expr<string>

  /** The substr(X,Y,Z) function returns a substring of input string X that begins with the Y-th character and which is Z characters long. If Z is omitted then substr(X,Y) returns all characters through the end of the string X beginning with the Y-th. The left-most character of X is number 1. If Y is negative then the first character of the substring is found by counting from the right rather than the left. If Z is negative then the abs(Z) characters preceding the Y-th character are returned. If X is a string then characters indices refer to actual UTF-8 characters. If X is a BLOB then the indices refer to bytes.*/
  substr(x: EV<string>, y: EV<number>, z?: EV<number>): Expr<string>

  /** The total_changes() function returns the number of row changes caused by INSERT, UPDATE or DELETE statements since the current database connection was opened. This function is a wrapper around the sqlite3_total_changes() C/C++ numbererface.*/
  total_changes(): Expr<number>

  /** The trim(X,Y) function returns a string formed by removing any and all characters that appear in Y from both ends of X. If the Y argument is omitted, trim(X) removes spaces from both ends of X.*/
  trim(x: EV<string>, Y: EV<string>): Expr<string>

  /** The typeof(X) function returns a string that indicates the datatype of the Expr X: "null", "numbereger", "real", "text", or "blob".*/
  typeof(x: EV<any>): Expr<string>

  /** The unicode(X) function returns the numeric unicode code ponumber corresponding to the first character of the string X. If the argument to unicode(X) is not a string then the result is undefined.*/
  unicode(x: EV<string>): Expr<number>

  /** The unlikely(X) function returns the argument X unchanged. The unlikely(X) function is a no-op that the code generator optimizes away so that it consumes no CPU cycles at run-time (that is, during calls to sqlite3_step()). The purpose of the unlikely(X) function is to provide a hnumber to the query planner that the argument X is a boolean value that is usually not true. The unlikely(X) function is equivalent to likelihood(X, 0.0625).*/
  unlikely(x: EV<boolean>): Expr<boolean>

  /** The upper(X) function returns a copy of input string X in which all lower-case ASCII characters are converted to their upper-case equivalent.*/
  upper(x: EV<string>): Expr<string>

  // =====================================================
  // http://www.sqlite.org/lang_aggfunc.html
  // =====================================================

  /** The avg() function returns the average value of all non-NULL X within a group. string and BLOB values that do not look like numbers are numbererpreted as 0. The result of avg() is always a numbering ponumber value as long as at there is at least one non-NULL input even if all inputs are numberegers. The result of avg() is NULL if and only if there are no non-NULL inputs. */
  avg(x: Expr<number>): Expr<number>

  /** The count(X) function returns a count of the number of times that X is not NULL in a group. The count(*) function (with no arguments) returns the total number of rows in the group. */
  count(x?: Expr<any>): Expr<number>

  /** The group_concat() function returns a string which is the concatenation of all non-NULL values of X. If parameter Y is present then it is used as the separator between instances of X. A comma (",") is used as the separator if Y is omitted. The order of the concatenated elements is arbitrary. */
  group_concat(x: EV<string>, y: EV<string>): Expr<string>

  /** The sum() and total() aggregate functions return sum of all non-NULL values in the group. If there are no non-NULL input rows then sum() returns NULL but total() returns 0.0. NULL is not normally a helpful result for the sum of no rows but the SQL standard requires it and most other SQL database engines implement sum() that way so SQLite does it in the same way in order to be compatible. The non-standard total() function is provided as a convenient way to work around this design problem in the SQL language. 

    The result of total() is always a numbering ponumber value. The result of sum() is an numbereger value if all non-NULL inputs are numberegers. If any input to sum() is neither an numbereger or a NULL then sum() returns a numbering ponumber value which might be an approximation to the true sum.

    Sum() will throw an "numbereger overflow" exception if all inputs are numberegers or NULL and an numbereger overflow occurs at any ponumber during the computation. Total() never throws an numbereger overflow.
   */
  sum(x: EV<number>): Expr<number>

  // =====================================================
  // http://www.sqlite.org/lang_mathfunc.html
  // =====================================================

  /** Return the arccosine of X. The result is in radians. */
  acos(x: EV<number>): Expr<number>

  /** Return the hyperbolic arccosine of X. */
  acosh(x: EV<number>): Expr<number>

  /** Return the arcsine of X. The result is in radians. */
  asin(x: EV<number>): Expr<number>

  /** Return the hyperbolic arcsine of X. */
  asinh(x: EV<number>): Expr<number>

  /** Return the arctangent of X. The result is in radians. */
  atan(x: EV<number>): Expr<number>

  /** Return the arctangent of Y/X. The result is in radians. The result is placed numbero correct quadrant depending on the signs of X and Y. */
  atan2(x: EV<number>, y: EV<number>): Expr<number>

  /** Return the hyperbolic arctangent of X. */
  atanh(x: EV<number>): Expr<number>

  /** Return the first representable numbereger value greater than or equal to X. For positive values of X, this routine rounds away from zero. For negative values of X, this routine rounds toward zero. */
  ceil(x: EV<number>): Expr<number>

  /** Return the cosine of X. X is in radians. */
  cos(x: EV<number>): Expr<number>

  /** Return the hyperbolic cosine of X. */
  cosh(x: EV<number>): Expr<number>

  /** Convert value X from radians numbero degrees. */
  degrees(x: EV<number>): Expr<number>

  /** Compute e (Euler's number, approximately 2.71828182845905) raised to the power X. */
  exp(x: EV<number>): Expr<number>

  /** Return the first representable numbereger value less than or equal to X. For positive numbers, this function rounds toward zero. For negative numbers, this function rounds away from zero. */
  floor(x: EV<number>): Expr<number>

  /** Return the natural logarithm of X. */
  ln(x: EV<number>): Expr<number>

  /** 
    Return the base-10 logarithm for X. Or, for the two-argument version, return the base-B logarithm of X.
    Compatibility note: SQLite works like PostgreSQL in that the log() function computes a base-10 logarithm. Most other SQL database engines compute a natural logarithm for log(). In the two-argument version of log(B,X), the first argument is the base and the second argument is the operand. This is the same as in PostgreSQL and MySQL, but is reversed from SQL Server which uses the second argument as the base and the first argument as the operand.
   */
  // TODO: log10(X) overload: log(B,X)
  log(x: EV<number>, y?: EV<number>): Expr<number>

  /** Return the logarithm base-2 for the number X. */
  log2(x: EV<number>): Expr<number>

  /** Return the remainder after dividing X by Y. This is similar to the '%' operator, except that it works for non-numbereger arguments. */
  mod(x: EV<number>, y: EV<number>): Expr<number>

  /** Return an approximation for π. */
  pi(x: EV<number>): Expr<number>

  /** Compute X raised to the power Y. */
  pow(x: EV<number>, y: EV<number>): Expr<number>

  /** Convert X from degrees numbero radians. */
  radians(x: EV<number>): Expr<number>

  /** Return the sine of X. X is in radians. */
  sin(x: EV<number>): Expr<number>

  /** Return the hyperbolic sine of X. */
  sinh(x: EV<number>): Expr<number>

  /** Return the square root of X. NULL is returned if X is negative. */
  sqrt(x: EV<number>): Expr<number>

  /** Return the tangent of X. X is in radians. */
  tan(x: EV<number>): Expr<number>

  /** Return the hyperbolic tangent of X. */
  tanh(x: EV<number>): Expr<number>

  /** Return the representable numbereger in between X and 0 (inclusive) that is furthest away from zero. Or, in other words, return the numbereger part of X, rounding toward zero. The trunc() function is similar to ceiling(X) and floor(X) except that it always rounds toward zero whereas ceiling(X) and floor(X) round up and down, respectively. */
  trunc(x: EV<number>): Expr<number>

  // =====================================================
  // https://www.sqlite.org/lang_datefunc.html
  // =====================================================
  date(timeValue: EV<any>, ...rest: Array<EV<string>>): Expr<string>

  time(timeValue: EV<any>, ...rest: Array<EV<string>>): Expr<string>

  datetime(timeValue: EV<any>, ...rest: Array<EV<string>>): Expr<string>

  julianday(timeValue: EV<any>, ...rest: Array<EV<string>>): Expr<string>

  strftime(
    format: EV<string>,
    timeValue: EV<any>,
    ...rest: Array<EV<string>>
  ): Expr<string>
}
