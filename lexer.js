export default class Lexer {
  constructor(text) {
    this.text = text;
  }

  getLexemes() {
    const lexemes = [];
    this.text.split('\n').forEach((line) => {
      if (line.match(/^\** .*/)) {
        lexemes.push({
          type: 'header',
          // XXX naive af
          level: line.split(' ')[0].length,
          value: line
        });
      } else if (line.match(/^DEADLINE: /) || line.match(/^SCHEDULED: /)) {
        lexemes.push({
          type: 'paragraph',
          value: line,
          _prop: true
        });
      } else {
        const last = lexemes[lexemes.length - 1];
        if (last && last.type === 'paragraph' && !last._prop) {
          last.value += '\n' + line;
        } else {
          lexemes.push({
            type: 'paragraph',
            value: line
          });
        }
      }
    });

    return lexemes;
  }
}
