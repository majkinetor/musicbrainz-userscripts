// ==UserScript==
// @name         MusicBrainz - Import Discogs Credits
// @namespace    majkinetor
// @version      2026-05-22
// @description  Add a button to import Discogs release relationships to MusicBrainz
// @author       majkinetor
// @match        https://musicbrainz.org/release/*/edit-relationships
// @match        https://musicbrainz.org/artist/*
// @match        https://musicbrainz.org/label/*
// @match        https://musicbrainz.org/place/*
// @match        https://beta.musicbrainz.org/release/*/edit-relationships
// @match        https://beta.musicbrainz.org/artist/*
// @match        https://beta.musicbrainz.org/label/*
// @match        https://beta.musicbrainz.org/place/*
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/578977/MusicBrainz%20-%20Import%20Discogs%20Credits.user.js
// @updateURL    https://update.greasyfork.org/scripts/578977/MusicBrainz%20-%20Import%20Discogs%20Credits.meta.js
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/discogs_credits
// @supportURL   https://github.com/majkinetor/musicbrainz-userscripts/issues
// @installURL   https://greasyfork.org/en/scripts/578977
// @icon64URL    data:image/x-icon;base64,AAABAAEAQEAAAAEAIAAoQgAAFgAAACgAAABAAAAAgAAAAAEAIAAAAAAAAEAAAA47AAAOOwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3J2QANyNkADcjZAA3I2QANydkAD8zYAA7I2AAMydkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANydoADMnaAAzK2wANyNkDDcjZBA3H2QQNxNkDDb/ZAQ242gANrdoADb3ZAA242wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALv90ADrLXAA6z1wANuNkCDbPZBA2s2gENsdoADbTaAA2p2QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3J2gINydoADcnaKw3I2bgOxNWWD8LTcBC90kIQutMSELbOABG/zAAMrdkADaTZBA2e2QENn9kADaHZAA2b2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtnwPALV8DwC1fA8AtnwPALN6DQCyegwAuH0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANydoCDsXVAA7F1SoMy9z/Btrt/wjV6P4Ky+H/DcDb8A+01rcQrNNgDqrWDw+j0wAOn9cCDZbZAg2a2AANm9gADZLaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6DwC0eg8AtHoPAbR6DwS1eg8CtHoPALR6DwC3fA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADcnaARDA0QAQwdIQDMrc6AHq+/8A7P/6AOb//QDf/P8C0PL+CL3l/w2s2ekQoNR6DJ3cCg+X1wANkdgDDZTYAA2V1wANitoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC1eg8AtXoPALV6DwCzeRAAs3kQAbR6DwKzehAAs3oQALZ7DQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzK2wALy90BE7bGAA7G2MsC5fX/C9T+/SCm9v8Yr/f+Ebf6/AbD/vwBxfn+B7Dm/w6a1toOk9c2EY/OAA6N1gQOhdYADYjZAA2C2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtHoPAbR6DwCzeg8UtHoPiLZ7Dh+2ew4AtXoPA7N6EACzehAAuXwNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMy90ADcjZBBC/zwAPw9WZBN7t/wnX//sokPH/J4zv/ymE6/8ngun/HY7u/Qms+/sCsPP/DZTZ+Q6M1k0Ris8ADojWBA581wANftkADn3cAAAAAAAAAAAAAAAAAAAAAAAAAAAAtnwRALR6DwO0eg8AtHoPQbR6D/+0eg/htnsOMrZ7DgC1eg8DtHoPALV6DwC6eQYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADcraAA3I2QMQwdEAEMHTVwnU5P8D4v/8JJPw/yaK7f8lhOr/Jnzn/yhv4v8pZ97/E4vx/AGp+P8NjNn5DoTXQBCE0QAXgcsDlF8dAF9paABwZlAAcGZQAGhfSwAAAAAAAAAAALR6DwC0eg8EtHoPALR6D1i1eg//tXsO/rN6D/G2ew43tnsOALV6DwK2ew4At3sOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3K3AANydoBD8PUAA7E1hgNydvtAej7/x6d8f4of+n/Jnzn/yZz5P8mbOH/J2Te/ytT1v8Tfu78AqD2/w+B1egUes8hDXnXABR9zwJvZVACcGZRAHBmUQBvZVAAAAAAAAAAAAC0eg8AtHoPBLN5EACzeg91tnsO/8uFBfe4fA3/s3oP4Ll8DRa3ew4AtnsOAbR6DwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALzd4ADcrbAA3H2AMRvcwAD8LVowTf7v8Ruvj8KXPl/yV15P8ma+D/J2Pd/ydb2v8nU9f/KUPQ/w2E8fsBk/T/Bnvjuzl+TwCu/zwAL3CrAXBlUAFvZVAAb2VQAHFnUgC0eg8AtHoPALR6DwOxeBEAs3kQn7d8Dv/TiQH7zIYE+rR6D/+0eg+XsnkQALN6DwO2ew4AuXwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3I2QANydoCD8TUAA/D1TsLzd7/BNz7/SR65f8naOD/J2Pd/yda2v8nUtf/J0rT/yk8zf8eQNr/FInh/kJxkf1pZFbSb2VP329lUYJvZVAAb2VQA2lgTQBwZVAAtHoPALR6DwC4ehEAxYIIBrJ5ENm9fgv/0okB/dOJAf7AgAr/snkQ9Ll8DSK2ew4AtnsPArZ7DgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMytsADMrcAA7B1QITtMYAD8HVpgXZ6/8Otfb7KljZ/ydc2v8nU9f/J0jS/yg/z/8lM9H/SkiO/3BjTv93ZEX9c2dQ/nFnUf9vZVD/cGZQP29lUABxaFMDtJdiALR6DwC0eg8FtXoPALZ7Dk+yeRD/x4MH/dOJAf/SiAL/zYYE+7R6D/+1eg90s3oPALR6DwS0ew8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADM/gAA3H2AAMx9sBDcfYAAzJ3BwOwdfmAtv1/xOb8PwqR9L/J0fS/yhCzv8kMdL/T0yH/3VqRf9zaVL/d21W/3tvVP16blT6cWdR/3BmUsqOhncDtbrCApyalgSmnooFunYBALp+DxKzeRDXuHwN/9GIAv3RiAL/0YgC/9KJAvy6fQz/s3kQvah0FACweBECt3sNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANytsADcnaAA7B2AMQvNIADsHYPw2+2fYC1vb/Dp3x/ChAzf8mKM//Q0Sb/3RoRv9yaFT/em9V/3puVP96blX/e29U/3RoTvtrYEr/a2BJc2xiTACBaTcFtnkAALttACG0eAvLs3oR/8qFB/3SiQL/0YgC/9GIAv/TiQH+wYAJ/7J5EOnAgAoPuHwOALZ7DgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACszeAA3G2QAOxdgADr3XAxG00AAOvNc/DrbY7wTL8f8Dtf77I17O/2xdU/9zaVD/em5V/3puVP96b1X/eGxR/3ltUv+FfGn+i4Z8/5OQiu2jo6OyoqOmoaadjZevhz7vtH4Z/8uDAf3VhwD/0YgC/9CIBP/QiAP/04kB/saDB/+yeRD+uHwNKbV7DwC1ew8CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMyNwADcHYAA7A1wAOu9cEELHRAA242CgRrNLSAMDz/zqYo/13X0T/dm5W/3puVP96b1X/eGtP/4J4Y/+bmJL/pKWm/6mqrP+srK3+qamp/6ioqP+lpab/oqSp/qShm/2zm2//xJEy/9KIBP/UhgD/0YgD/9KJA//IhAb+s3kQ/7d7Dji1eg8AtXoOAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzC2wANudgADbrYAA262QMA8P8ADr3aCA2o145dbmf+dmVM/npvVf96blX/eGtQ/4d+bP+jpKT/qamq/7Ozs/+6urr/vb29/r6+vvy9vb37u7u7+7a2tf6ur7H/pKix/6Ckq/+rnoj/wZM//9GIBf/VhwD/yIQI/rJ6Ef+3ew01tXoOALV7DwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADbzaAA212QANtdkAKZ+xA/8AAAB9YUMJb2RP5HJoUf97b1X7em1S/350XP+ioaD/qqqr/7u7uv+/v7//vb29/729vf+9vb3/vb29/76+vv++vr7/v7++/728uv+1tLL/p6qv/5+krv+qnoj/x5Iy/saAAP+yeAz6toEgJLV6DgC1eQoCpaWlAKenpwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMtdsADa/ZAP8AAABGhYoCxCgAAG9lUZVvZVD/cWdS/XRoTfyPiXz/p6iq/7i4t/+/v7//vLy8/729vf+9vb3/vb29/729vf+9vb3/vb29/729vf+9vb3/v7+//769vP+1tLL/pqmu/6GlrP2sl3D/soAi3MtTAAVq//8Bq5ZxAqSkpACkpKQAqKioAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANrNsAdmFHAGpoVwFwZE4Ab2ZQSW9lUdttY03/lpOO/q2trv+9vb3/vb29/729vf+9vb3/vb29/729vf+9vb3/vb29/729vf+9vb3/vb29/729vf+9vb3/v7+//729u/+xsbD+o6at/6OjovampaRfoJyUAKGhoQKlpaUDo6OjAKOjowCmpqYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAb2VQAG9lUABvZVAAb2VQA2FUNwBxZ1AJcGVQhZqYlf6vr7D/vr6+/729vf+9vb3/vb29/729vf+9vb3/vb29/7y8vP+7u7v/u7u7/7y8vP+9vb3/vb29/729vf+9vb3/v7+//7q5t/+qqqr+oqKi/6SkpKWqqqoNrKysAKWlpQS8vLwAra2tAKWlpQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG9kTwBvZVAAb2ZRAG5mUQB2bVsEYllEAUNJTwCioqLUra2t/7+/v/29vb3/vb29/729vf+9vb3/vb29/7y8vP+/v8D/xMXG/8TFxv/Cw8T/vLy8/729vf+9vb3/vb29/729vf++vr7/vr6+/rGxsfujo6P/o6Oj2Kenpy2np6cApKSkBKampgCmpqYApaWlAKOjowAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG5lUACKbTcAYRAAAJWIbwSnv+0AoqOjwKqqqv++vr78vb29/729vf+9vb3/vb29/7y8vP/BwsL/s7Kx/4+Lg/+Hg3r/op+b/8HBwf+9vb3/vb29/729vf+9vb3/vb29/729vf+/v7//t7e3+6ampv+jo6P1pqamU6WlpQCkpKQEpaWlAaWlpQClpaUAq6urAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALd7DgC0eg8AtHoPALV7DwLSOAAAxVwAFqmVceemqa7/vby7/r29vf+9vb3/vb29/7y8vP/BwcL/q6mm/2JaSv9YTzv/W1E9/1dOO/+Ig3r/wcLC/7y8vP+9vb3/vb29/729vf+9vb3/vLy8/76+vv+7u7v8qamp/aKiov+lpaV2oaGhAKSkpAOmpqYBpqamAKampgCoqKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC9ewkAtnsOAKM8VQC3fAwAtnsOALV6DgC1ew8BtXoPArR6DwSweRADuGAAALZ2AKOtiET/oqev/Li3tv++vr7/vb29/729vf+8vLz/wMHB/3NtYP9bUTz/aF5J/2ZcR/9lW0b/WVA9/6emov/BwsP/vLy8/729vf+9vb3/vb29/729vf+9vb3/vr6+/76+vv6tra37oqKi/6WlpZGbm5sApaWlAqampgGnp6cAp6enAKioqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtnsOALl8DAC7fQoAtHoPA7R6DwOyeRACj2IdALh8DQHvkQAA4YwAArV7EJOzeAz/v4Ud/KWinv+wsbL/v7++/729vf+9vbz/v7+//7a2tf9kXEz/Y1lE/2RaRf9kWkX/ZlxH/1pRPf+Sjof/xMXG/7y8vP++vr7/v7+//7+/v//AwMD/wMDA/8DAwP/AwMD/wcHB/rGxsfqjo6P/paWlosjIyAGkpKQCp6enAaioqACoqKgAqqqqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP+iAADAgAoA1osBAMuGBgS6fQ0ftXoPYrN5ENOyeRD/wYEK/NWIAP+vnHn/pamx/769u/+9vb3/vb29/729vf+8vLz/amNU/2BWQf9nXUj/ZVtG/2ddSf9YTjv/npuW/8XGx/+/v7//wcHB/8LCwv/Dw8P/w8PD/8PDw//Dw8P/w8PD/8LCwv/ExMT/tra2+qWlpf+np6ess7OzA6ampgGoqKgBqampAKmpqQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC2ew4A4Y0AAJBrJwC0eg98tHoPrbR6D7+yeRDbsnkQ+LN6D/+5fQ3/yIQG/NKJBP/UhgD/wZI9/6Clrf+2tbP/vr6//729vf+8vLv/w8PE/5eUjf9WTTn/XlRA/2FXQv9WTDj/cGpc/8DAwP/Dw8P/w8PD/8TExP/FxcX/xsbG/8bGxv/Gxsb/xsbG/8bGxv/Gxsb/xcXF/8bGxv+4uLj6p6en/6ioqKvZ2dkBqampAqioqAHHx8cAq6urAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtnsOAKZ2FACteBIAtHoPv7R6D/+0eg/8v38K/8WCB//LhQX70ogC/dOJAf/RiAP/0YgB/9CJCP+on5D/qauv/76+vf+9vb3/vb29/7y8vP/BwcL/mpeR/3BqXf9sZVb/hH91/7u7uv/Gxsf/xMTE/8bGxv/Hx8f/yMjI/8jIyP/IyMj/ycnJ/8nJyf/Jycn/ycnJ/8jIyP/Hx8f/yMjI/7q6uvqoqKj/qamplKioqACqqqoDmJiYAKurqwCurq4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC1eg4BuHwNALl8DQW1eg+atHoP/71/C/zQiAL71YoA/9GIAv/QiAL/0YgC/9CIBP/UhgD/vZVN/6Clr/+3trT/vr6+/729vf+9vb3/vLy8/8PDxP/CwsL/wcHB/8nKy//Hx8f/xsbF/8jIyP/Jycn/ysnJ/8nJyf/Nzc3/z8/Q/83Nzf/Lysr/zMzM/8zMzP/Ly8v/ysrK/8nJyf/Kysr/uLi4+6mpqf+rq6tkqqqqAKqqqgSrq6sAq6urAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC2ew4AtXoPALZ6DgGyeRACsnkQALV6D2GyeRDytHoP/8OBCPzQiAL804kB/tKJAv/RiAP/0YgA/8+JC/+noJL/qKqu/76+vf+9vb3/vb29/729vf++vr7/wcHB/8TExP/ExMT/x8fH/8nJyf/Ly8v/y8vL/8/P0P/W1tf/ysrK/8TDwv/Ozs7/2NjZ/9DQ0P/Ozs7/zs7O/83Nzf/MzMz/ysrK/8rKyv6zs7P/qamp8q2trSmrq6sAq6urAq6urgCsrKwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAun0MALV6DwC1eg8AtXsPAbR6DwS4fA0AuXwNH7R6D6+yeRD/t3sO/8OBCP7MhgT70YgC+9KJBPzWhwD9wpVE/aClr/y1tLL+v7+//729vf+/v7//wcHB/8TExP/Gxsb/yMjI/8rKyv/MzMz/zMzM/9PT0//JyMf/ioV7/2hhUv9jW0v/bGVW/5eTi//T09P/09TU/9DQ0P/Q0ND/z8/P/83Nzf/MzMz/x8fH/K6urv+rq6u6nJycAK6urgGqqqoArKysAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC5fA4AtXoPALd7DgC3ew4AtHoPA653EQGpdBMAtnsOP7N6D7eyeRD6tHoP/7h8Df+7fgz/vX8L/75+CP+omX//pait/by7uv+/v7//wcHB/8PDw//Gxsb/yMjI/8rKyv/MzMz/zs3N/9LS0//Kycj/bWZY/1ZMOP9hV0L/YlhD/2BWQf9TSjb/gHtv/9fX1//U1NT/09PT/9HR0f/Q0ND/zs7O/87Ozv/AwMD8q6ur/62trWCrq6sArKysA6ampgCtra0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC2ew4AtHoPALR6DwC1eg8CtHoPA49nIQCmcxYAuHwNJLR6D2mzeRCfsnkQwbJ6EtGzdwfPsIY5waKkqPWurq3/wsLC/8LCwv/FxcX/yMjI/8rKyv/MzMz/z8/P/8/Pz//a29z/ioZ7/1ZMOP9oX0r/ZVtG/2RaRf9lW0b/aF5J/1RKN/+lopv/3+Dh/9TU0//U1NT/0tLS/9HR0f/Ozs7/zc3N/bW1tf+rq6vdsbGxDqqqqgCsrKwBra2tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALp8DQC1eg8AuXwNALx+DAC0eg8DtHoPArR6DwC0eg8AsXkQAAAAAACkpKQApaWlA6SkpAClpaWJpaWl/7q6uvvGxsb/x8fH/8rKyv/MzMz/z8/P/9DQ0P/U1dX/0M/P/2hhUf9hV0L/ZVtG/2RaRf9kWkX/ZFpF/2ZcR/9cUj3/fHZq/9/f4P/X19f/19fX/9XV1f/T09P/0NDQ/9DQ0P/Gxsb7ra2t/6ysrXWvr6wAra2tBJ+grwBQUr8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALh7DQC1eg8AtnsNALZ7DgC0eg8CtHoPBLR6DwSyeQ8ClnE2AKiRZwHFAAAAqqyvB6ampsyrq6v/xMTE/MrKyv/Ly8v/zs7O/9HR0f/S0tL/2NnZ/8rJyP9jW0r/Y1lE/2RaRf9kWkX/ZFpF/2RaRf9lW0b/XlQ//3NtX//d3d7/29vb/9nZ2f/X19f/1dXV/9PT0//Pz9D/zc3Q/be3t/+urqzetbWxDcTEpQC+vakBODvEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3ew0At30OALiADwC2fQ4AtnsPALZ8EAC4dAAAqqafA6uqqgCrq6swqamp9bOzs//Ly8v+zc3N/9DQ0P/S0tL/1dXU/9jY2P/X19f/bGVW/2BWQf9lW0b/ZFpF/2RaRf9kWkX/Z11I/1pRPP+CfXH/5ufn/9zc3P/c3Nz/2tra/9fX1//S0tX/19fR/9zc0P/IyMX8p6ev/6KjsGCpqa4AqqquAzo+xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApaWlAKSkpACrq6sEra2tAK2trWOsrKz/vb29+9HR0f/R0dH/1NTU/9fX1//X19f/5eXm/5uWjv9SSTX/aF5K/2ZcR/9lW0b/Z11I/2ZcR/9TSjf/uLax/+rq6//e3t7/3t7e/9ra3P/a2tn/4uLW/8DA1v9/gdv/UlXh/EBEyP9ARMG9UFSzAFVYvgE4O8QANzrDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKioqACoqKgA////AK2trQOwsLAAr6+vkq+vr//FxcX61dXV/9XV1f/Y2Nj/2tra/97e3v/g39//gnxw/1JJNf9cUj3/XlQ//1pQPP9TSjf/mpaN/+zt7f/j4+P/4+Pi/93d4P/k5N3/2trb/4GE3/84POX/Ki7m/y8z6P4zN9b/NTnC+zg8xys4PMQANzvEAjc7xQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAq6urAMHBwQCxsbEBra2tAbS0tAKysrK2s7Oz/8zMzPvY2Nj/2dnZ/9zc3P/e3t7/5OTk/+bm5v+sqaL/fnhr/3RuYP+Ef3P/vbu1//Dx8v/p6en/5+fm/+Hh5P/s6+L/yMng/1JV4/8oLOb/NDjl/zg85P82Oub/Njrh+zc7xP83O8R4NzvDADc7xAQ3OsQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACtra0Ara2tALKysgK6uroAtra2D7S0tM+3t7f/0tLS+9zc3P/d3d3/4eHh/+Li4v/m5ub/8vP0//Dx8f/t7e3/9fb3//f3+P/s7Oz/6+vr/+bm6f/x8eb/vr7k/zxA5f8sMeX/OT3l/zU55f81OeX/NTnl/zU55/w3O8z/NzvCxTc8rgA2O8MBNzvFADY8wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsLCwALCwsACwsLAAtbW1Arq6ugC5ubkdtra23bu7u//X19f84ODg/+Dg4P/k5OT/5+fn/+jo6P/s7Oz/8PDw//Dw8P/w7+//8PDv/+rq7f/09Or/w8Pn/zc75f8wNOX/ODzl/zU55f81OeX/NTnl/zU55P81Oef+NjrW/zc7wvg3O8giNzvEADc7xAI4PMYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACvr68As7OzALOzswC3t7cDu7u7ALu7uya5ubnkvr6+/9ra2vvk5OT/5OTk/+jo6P/r6+v/7u7u//Hx8f/09PT/9PT0/+/v8f/09O7/19jq/z9D5f8wNOX/ODzl/zU55f81OeX/NTnl/zU55f81OeX/NTnm/zU53vw3O8P/NzvEWjc7wwA3O8QENzvEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALS0tAC2trYAtra2ALm5uQO9vb0Avb29Kbu7u+LAwMD/2NjY++fn5//o6Oj/6urq/+7u7v/w8PD/8/Pz//Pz8//w8PD/8PDt/1xf5v8rL+X/ODzl/zU55f81OeX/NTnl/zU55f81OeX/NTnl/zU55f81OeT7NzvH/zc7w5M3O8EANzvEBDg7xgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuLi4ALi4uAC4uLgAu7u7A8HBwQDAwMAdvr6+zL+/v//T09P75+fn/evr6//s7Oz/7u7u//Dw8P/t7fD/+/vv/5aY6f8mK+T/OT3l/zU55f81OeX/NTnl/zU55f81OeX/NTnl/zU55f81OeX/NTnn/Dc6zP83O8LCNzy3ADY7wwE3O8QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC5ubkAu7u7ALu7uwC9vb0D3d3dAMTExAjBwcGawMDA/8rKyv7h4eH77e3t/u3t7f/r6+z/8fHt/9vc6/89QeX/Mzfl/zY65f81OeX/NTnl/zU55f81OeX/NTnl/zU55f81OeX/NTnk/zU56P02OtL/NzvB4zY60go3O8QANzvEAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALy8vAC9vb0Avb29AL6+vgLAwMADw8PDAMTExE/BwcHkxMTE/9TU1P3m5ub76urs/vj46/+Rk+f/KCzk/zg85f81OeX/NTnl/zU55f81OeX/NTnl/zU55f81OeX/NTnl/zU55P81Oef+NjrX/zc7wvk3O8ghNzvEADc7xAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvr6+AL+/vwC/v78Av7+/AcHBwQTJyckAycnJD8PDw43CwsL4xsbG/9TU1P7m5uP7WFvn/S0y5/83O+X/NTnk/zU55f81OeX/NTnl/zU55f81OeX/NTnl/zU55f81OeX/NTnn/zY62/43O8L/NzvGOzc7xAA3O8QDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDw8MAwcHBAL29vQC7u7sAwsLCA8PDwwLExMQAxsbGJMLCw6LEw8H5ubnE/0BDz/8zN9z8Njrl+zU55/41Oef/NTnm/zU55f81OeX/NTnk/zU55P81OeX/NTnk/zU55v81Od/8NzvD/zc7xFQ3O8MANzvEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADCwsIAxMTEAMPDwwDDw8MBxMTEA76+vgHz8r8A09PHJLW1wYpARMLkNTnD/zc7yP42OtH/Njra/jU54fs1OeX7NTnn/DU56P41Oef+NTnn/zU55v81Oef/NTni+zc7xf83O8RsNzvDADc7xAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDw8MAxMTEAMTExADDw8MCw8PDAwAAywA0N84ANzrOCzc7xVI3O8OoNzvC6Dc7wv83O8X/NzvI/zc6zf82OtL/NjrX/zY63P01Od/7NTnj+zU54fY3O8X/NzvEdDc7wwA3O8QEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMPDwwDFxcUArq6uANjXrgDHx8MCubnCBEZKwwAtMckANjnKADc6zgw3O8c7NzvEcTc7w6I3O8LJNzvC5zc7wvs3O8L/NzvE/zc7xv83O8b+NzvE/zc7xUI3O8QANzvEAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjIyABpa8MAFxzFAAAAxwA5PcUBNzvEBDc7wwM/NdQAE1V4ADY72wA3OrUANzqzADc60ws3O8kiNzvGPTc7xVo3O8N4NzvDiTc7xU41OsEANTvAADg7xgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA5O8UAODvFACtBrgA4OscANzvFATc7xQM3O8QENzvEBDc8wgE3OsQANzrEADdFvgAAAAAANzvDADc7xAA3O8QANzvEATc7xAA3O8QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADc6yAA3O8UAODy/ADg7xgA3O8UANzvGATc7xQI3O8QDNzvEBDc7xAQ3O8QENzvEAzs8zAA6O8oAODvFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO0DQADs/zwA7P9AAOz3NADs/zwA7P88AOjrLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////////////////////////////////////8f/////////QF/////////5E////////0CF//v/////QBJ/0X////9ABT/Uv////yACv9Ff////IAFf0K////8gAIvQV////6AARZAn////kABFkCf///+QAAogE////4gABKAT////yAAAQBP////UAAKAC////+oAAAAL////9QAAAAv////ygAAAC/////1AAAAJ/////iAAAAL/////EAAACT////9IAAACX////6IAAAEv////6gAAAJf////UAAAAS////AQAAAAl///oEAAAAAL///6AAAAAAX//7AAAAAAAv//kAAAAAAI///QAAAAAAV//6QAAAAAAn//0gAAAAACP//ogAAAAAE///IgAAAAAJ///RZAAAAAn///QAAAAABP///4IAAAAE////9QAAAAT////4gAAAAn////oAAAACf////UAAAAJ////+oAAAAX////9QAAABP////6gAAAE/////1AAAAT/////qAAAAv/////SAAAC/////+kAAAL/////9EAAAv/////9EAAC//////5EAAL//////5CAAv//////5GQE///////9AtL////////wAv/////////v////////////////////////////////8=
// @grant        unsafeWindow
// ==/UserScript==

let db;
const request = indexedDB.open('mblink');
request.onerror = function () {
    console.error("Why didn't you allow my web app to use IndexedDB?!");
};
request.onsuccess = function (event) {
    db = event.target.result;
};
request.onupgradeneeded = function (event) {
    const db = event.target.result;

    // Create an objectStore to hold information about our customers. We're
    // going to use "ssn" as our key path because it's guaranteed to be
    // unique - or at least that's what I was told during the kickoff meeting.
    db.createObjectStore('mblinks', {
        keyPath: 'discogs_id',
    });
};

// ── BroadcastChannel: cross-tab artist creation signalling ────────────────────
// When this script runs on an MB artist page that was opened by the "Create in MB"
// button, it detects the successful creation (URL contains a MBID) and posts the
// new artist data back to the opener tab, then closes itself.
const DISCOGS_CHANNEL = new BroadcastChannel('discogs-importer-artist');

(function handleEntityPageIfNeeded() {
    // Match artist, label, or place pages with a MBID
    const entityMatch = location.href.match(
        /musicbrainz\.org\/(artist|label|place)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[^/]|$)/i
    );
    if (!entityMatch) return;

    const entityType = entityMatch[1];
    const mbid       = entityMatch[2];

    // Check if we were opened by the importer
    const pendingKey = 'discogs-importer-pending-artist';
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;

    sessionStorage.removeItem(pendingKey);

    // Fetch entity name to send back
    fetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`)
        .then(r => r.json())
        .then(json => {
            DISCOGS_CHANNEL.postMessage({
                type: 'artist-created',  // keep same message type for compatibility
                id: mbid,
                name: json.name || '',
                disambiguation: json.disambiguation || '',
                resourceUrl: pending,
            });
            setTimeout(() => window.close(), 800);
        })
        .catch(() => {
            DISCOGS_CHANNEL.postMessage({
                type: 'artist-created',
                id: mbid,
                name: '',
                disambiguation: '',
                resourceUrl: pending,
            });
            setTimeout(() => window.close(), 800);
        });
})();

// Access the real page window where MB lives.
const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

let lastRequest;
let lastUiItem;

////////////////////////////////////////////////////////////////////////////////////////////////////////

let logs, summary, discogsUrl;

$(document).ready(function () {
    const re = new RegExp('musicbrainz.org/release/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/edit-relationships', 'i');
    let m;
    if ((m = window.location.href.match(re))) {
        hasDiscogsLinkDefined(m[1]).then(discogsUrlParam => {
            discogsUrl = discogsUrlParam;
            if (discogsUrl) {
                insertDiscogsBar(discogsUrl);
            }
        });
    }
});

// ── Progress bar (module-level so all functions can access) ─────────────────
let _pInterval = null;
let _pPos = -40;

function _showBar() {
    const row1 = document.querySelector('.discogs-bar-row1');
    const row2 = document.querySelector('.discogs-bar-row2');
    const r1h = row1 ? row1.getBoundingClientRect().height : 42;
    let pb = document.getElementById('discogs-pb');
    if (!pb) {
        pb = document.createElement('div');
        pb.id = 'discogs-pb';
        pb.style.cssText = 'position:fixed;left:0;right:0;height:5px;z-index:99999;background:#ddd;overflow:hidden;';
        const fill = document.createElement('div');
        fill.id = 'discogs-pb-fill';
        fill.style.cssText = 'position:absolute;top:0;height:100%;width:40%;background:#e8771d;';
        pb.appendChild(fill);
        document.body.appendChild(pb);
    }
    pb.style.top = r1h + 'px';
    pb.style.display = 'block';
    if (row2) row2.style.marginTop = (r1h + 5) + 'px';
    clearInterval(_pInterval);
    _pPos = -40;
    _pInterval = setInterval(() => {
        _pPos += 1.5;
        if (_pPos > 100) _pPos = -40;
        const fill = document.getElementById('discogs-pb-fill');
        if (fill) fill.style.left = _pPos + '%';
    }, 16);
}

function _hideBar() {
    clearInterval(_pInterval);
    const pb = document.getElementById('discogs-pb');
    if (pb) pb.style.display = 'none';
    const row2 = document.querySelector('.discogs-bar-row2');
    if (row2) row2.style.marginTop = '';
}

function insertDiscogsBar(discogsUrl) {
    // Inject styles
    const style = document.createElement('style');
    style.innerText = `
        .discogs-bar {
            font-family: inherit;
            background: #fff;
            border: 1px solid #e0c88a;
            border-left: 4px solid #e8771d;
            border-radius: 0.35rem;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        .discogs-bar-row1 {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.5rem 0.75rem;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
        }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source {
            flex: 1;
            font-size: 0.82rem;
            color: #555;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .discogs-bar .discogs-source a {
            color: #e8771d;
            text-decoration: none;
            font-weight: bold;
        }
        .discogs-bar .discogs-source a:hover { text-decoration: underline; }
        .discogs-import-btn {
            flex-shrink: 0;
            padding: 0.3rem 1rem;
            background: #e8771d;
            color: #fff;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.88rem;
            font-weight: bold;
            letter-spacing: 0.01em;
        }
        .discogs-import-btn:hover { background: #cf6618; }
        .discogs-import-btn:disabled { background: #c8a070; cursor: default; }
        .discogs-bar-row2 {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.75rem;
            flex-wrap: wrap;
        }
        .discogs-bar-row2 .discogs-opts-label {
            font-size: 0.75rem;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-right: 0.2rem;
            flex-shrink: 0;
        }
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.55rem 0.15rem 0.35rem;
            border: 1px solid #d8c8a0;
            border-radius: 2rem;
            background: #fffdf7;
            cursor: pointer;
            font-size: 0.8rem;
            color: #555;
            user-select: none;
            transition: background 0.12s, border-color 0.12s;
        }
        .discogs-toggle:hover { border-color: #e8771d; color: #333; }
        .discogs-toggle input[type=checkbox] { display: none; }
        .discogs-toggle .discogs-toggle-dot {
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2px solid #bbb;
            background: #fff;
            flex-shrink: 0;
            transition: border-color 0.12s, background 0.12s;
        }
        .discogs-toggle.active {
            background: #fff8ee;
            border-color: #e8771d;
            color: #333;
        }
        .discogs-toggle.active .discogs-toggle-dot {
            border-color: #e8771d;
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: #555; }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* ── Progress / sticky bar ── */
        .discogs-bar.is-importing .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .discogs-progress-track {
            height: 5px;
            background: #eeddb0;
            border-radius: 3px;
            overflow: hidden;
        }
        .discogs-progress-fill {
            height: 100%;
            width: 0%;
            background: #e8771d;
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .discogs-progress-fill.indeterminate {
            width: 40%;
            animation: discogs-slide 1.4s ease-in-out infinite;
        }
        @keyframes discogs-slide {
            0%   { margin-left: -40%; }
            100% { margin-left: 100%; }
        }
        .discogs-progress-status {
            font-size: 0.8rem;
            color: #7a5000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-recent-logs {
            font-size: 0.78rem;
            color: #888;
            max-height: 3.2rem;
            overflow: hidden;
            line-height: 1.4;
        }
        .discogs-recent-logs span {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-toggle { position: relative; }
        .discogs-tooltip {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: #fff;
            font-size: 0.78rem;
            line-height: 1.45;
            padding: 0.45rem 0.65rem;
            border-radius: 0.3rem;
            white-space: normal;
            width: 220px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            pointer-events: none;
            z-index: 9999;
            text-align: left;
        }
        .discogs-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        .discogs-toggle:hover .discogs-tooltip { display: block; }
    `;
    document.head.appendChild(style);

    // Build the bar
    const bar = document.createElement('div');
    bar.className = 'discogs-bar';

    // ── Row 1: logo + source URL + import button ──────────────────────────────
    const row1 = document.createElement('div');
    row1.className = 'discogs-bar-row1';

    const logo = document.createElement('img');
    logo.src = DISCOGS_LOGO_URL;
    logo.className = 'discogs-logo';
    logo.alt = 'Discogs';
    row1.appendChild(logo);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'discogs-source';
    sourceSpan.innerHTML = `<a href="${discogsUrl}" target="_blank" rel="noopener noreferrer nofollow">${discogsUrl}</a>`;
    row1.appendChild(sourceSpan);

    const importBtn = document.createElement('button');
    importBtn.className = 'discogs-import-btn';
    importBtn.textContent = 'Import from Discogs';
    const progressPct = document.createElement('span');
    progressPct.id = 'discogs-progress-pct';
    progressPct.style.cssText = 'display:none; margin-left:0.5rem; font-size:0.85rem; color:#e8771d; font-weight:bold; min-width:3.5rem;';
    row1.appendChild(importBtn);
    row1.appendChild(progressPct);
    bar.appendChild(row1);

    // ── Row 2: option toggles ─────────────────────────────────────────────────
    const row2 = document.createElement('div');
    row2.className = 'discogs-bar-row2';

    const optsLabel = document.createElement('span');
    optsLabel.className = 'discogs-opts-label';
    optsLabel.textContent = 'Options:';
    row2.appendChild(optsLabel);

    function makeCheckbox(labelText, checkedByDefault, tooltipText) {
        const lbl = document.createElement('label');
        lbl.className = 'discogs-toggle' + (checkedByDefault ? ' active' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checkedByDefault;
        const dot = document.createElement('span');
        dot.className = 'discogs-toggle-dot';
        lbl.appendChild(cb);
        lbl.appendChild(dot);
        lbl.appendChild(document.createTextNode(labelText));
        if (tooltipText) {
            const tip = document.createElement('span');
            tip.className = 'discogs-tooltip';
            tip.textContent = tooltipText;
            lbl.appendChild(tip);
        }
        lbl.addEventListener('click', (e) => {
            e.preventDefault();
            cb.checked = !cb.checked;
            lbl.classList.toggle('active', cb.checked);
        });
        row2.appendChild(lbl);
        return cb;
    }

    const OPTS_KEY = 'discogs-importer-opts';
    let savedOpts = {};
    try { savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'); } catch(e) {}
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;

    const tracklistCb    = makeCheckbox('Per-track credits',              bv('tracklist', true),
        'Import per-track artist credits from Discogs.');
    const applyTracksCb  = makeCheckbox('Move release credits to tracks', bv('applyTracks', true),
        'Move performance credits from the release down to every recording.');
    const createWorksCb  = makeCheckbox('Create missing works',           bv('createWorks', true),
        'Create a new inline work for recordings without one, and link composer/lyricist/writer credits to it.');
    const saveOpts = () => {
        try { localStorage.setItem(OPTS_KEY, JSON.stringify({
            tracklist: tracklistCb.checked, applyTracks: applyTracksCb.checked,
            createWorks: createWorksCb.checked,
        })); } catch(e) {}
    };
    [tracklistCb, applyTracksCb, createWorksCb].forEach(cb =>
        cb.closest('label').addEventListener('click', () => setTimeout(saveOpts, 0)));

    bar.appendChild(row2);

    // ── Progress bar ──────────────────────────────────────────────────────────
    // _showBar / _hideBar are module-level (defined before insertDiscogsBar)

    // Compat shims — old code references these names
    const progressBar = { style: { display: '' } };
    const progressRow = progressBar;
    const progressTrack = progressBar;
    const progressFill = { style: {}, className: '' };
    const progressStatus = { textContent: '' };
    const recentLogsEl = { innerHTML: '' };
    const recentLogBuffer = [];
    function pushRecentLog() {}
    function startProgressAnim() { _showBar(); }
    function stopProgressAnim() { _hideBar(); }

    // Output area
    const outputDiv = document.createElement('div');
    outputDiv.className = 'discogs-output';

    importBtn.addEventListener('click', () => {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';
        progressPct.style.display = 'inline';
        progressPct.textContent = '0%';

        // Show sticky progress bar
        bar.classList.add('is-importing');
        startProgressAnim();
        bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        bar._showProgress = () => { _showBar(); };
        requestAnimationFrame(bar._showProgress);

        // Fresh log/summary elements each run
        logs = document.createElement('ul');
        logs.className = 'logs';
        summary = document.createElement('p');
        summary.className = 'summary';
        outputDiv.innerHTML = '';
        outputDiv.appendChild(summary);
        outputDiv.appendChild(logs);

        const copyLogBtn = document.createElement('button');
        copyLogBtn.textContent = 'Copy log';
        copyLogBtn.style.cssText = 'font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;margin-left:auto;flex-shrink:0;';
        copyLogBtn.addEventListener('click', () => {
            function htmlToMd(el) {
                function nodeToMd(node) {
                    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
                    const tag = node.tagName?.toLowerCase();
                    const inner = [...node.childNodes].map(nodeToMd).join('');
                    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
                    if (tag === 'em' || tag === 'i') return `_${inner}_`;
                    if (tag === 'a') return `[${inner}](${node.href})`;
                    if (tag === 'br') return '\n';
                    if (tag === 'pre') {
                        // Raw JSON block — wrap in fenced code
                        return '\n```json\n' + node.textContent + '\n```\n';
                    }
                    if (tag === 'details') {
                        const sum = node.querySelector('summary');
                        const sumText = sum ? [...sum.childNodes].map(n => {
                            if (n.nodeType === Node.TEXT_NODE) return n.textContent;
                            if (n.tagName?.toLowerCase() === 'strong') return '**' + n.textContent + '**';
                            return n.textContent;
                        }).join('') : '';
                        // Get non-summary children
                        const body = [...node.childNodes].filter(n => n !== sum).map(nodeToMd).join('');
                        return '<details><summary>' + sumText + '</summary>\n\n' + body + '\n</details>';
                    }
                    if (tag === 'summary') return ''; // handled by details
                    if (tag === 'span') return inner;
                    if (tag === 'div') return inner + '\n';
                    if (tag === 'ul') return inner;
                    if (tag === 'li' && el !== node) return '- ' + inner + '\n';
                    if (tag === 'table') {
                        const rows = [...node.querySelectorAll('tr')];
                        if (!rows.length) return '';
                        const cells = rows.map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.trim().replace(/\|/g,'\\|')));
                        const widths = cells[0]?.map((_, i) => Math.max(...cells.map(r => (r[i]||'').length), 3));
                        const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
                        const mdRows = cells.map(row => '| ' + row.map((c,i) => pad(c, widths[i])).join(' | ') + ' |');
                        if (mdRows.length > 1) mdRows.splice(1, 0, '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |');
                        return '\n\n' + mdRows.join('\n') + '\n\n';
                    }
                    return inner;
                }
                const _md = nodeToMd(el); return _md.startsWith('\n\n') || _md.endsWith('\n\n') ? _md : _md.replace(/^\n/, '').replace(/\n$/, '');
            }
            const lines = [...logs.querySelectorAll('li')].map(li => {
                const md = htmlToMd(li);
                // Add trailing two-spaces for markdown line breaks, except tables/details
                if (md.startsWith('\n\n|') || md.startsWith('<details>')) return md;
                return md + '  ';
            }).join('\n');
            navigator.clipboard.writeText(lines).catch(() => {
                const ta = Object.assign(document.createElement('textarea'), { value: lines });
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            }).finally?.(() => {});
            copyLogBtn.textContent = 'Copied!';
            setTimeout(() => { copyLogBtn.textContent = 'Copy log'; }, 1500);
        });
        row2.appendChild(copyLogBtn);

        // Expose progress update hooks for instantFillRelationships to call
        bar._setProgress = (pct, statusText) => {
            if (pct !== null && pct >= 100) { stopProgressAnim(); }
            if (statusText) {
                progressStatus.textContent = statusText;
                pushRecentLog(statusText.replace(/<[^>]*>/g, ''));
            }
        };

        // Re-show progress bar
        requestAnimationFrame(_showBar);

        const opts = `per-track:${tracklistCb.checked?'on':'off'}, move-to-tracks:${applyTracksCb.checked?'on':'off'}, create-works:${createWorksCb.checked?'on':'off'}`;
        const editNote = buildEditNote(discogsUrl, opts);
        editNote.split('\n').forEach(line => {
            if (!line.trim()) return;
            // Make URLs clickable in the log
            const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
            addLogLine(html);
        });
        startImportRels(discogsUrl, tracklistCb.checked, applyTracksCb.checked, createWorksCb.checked).finally(() => {
            importBtn.disabled = false;
            importBtn.textContent = 'Import from Discogs';
            progressPct.textContent = '100%';
            setTimeout(() => { progressPct.style.display = 'none'; }, 2000);
            // Freeze progress at 100% then remove sticky after a moment
            progressFill.className = 'discogs-progress-fill';
            progressFill.style.width = '100%';
            progressStatus.textContent = 'Done';
            setTimeout(() => {
                bar.classList.remove('is-importing');
                stopProgressAnim();
            }, 2000);
            delete bar._setProgress;
        });
    });

    bar.appendChild(outputDiv);

    // Insert the bar at the very top of the page content area.
    // The MB edit-relationships page wraps everything in #content > .release-rel-editor
    // (or similar). We want to be the very first thing inside that wrapper,
    // above any other userscript toolbars (e.g. loujine batch tools).
    function insertBar() {
        // Try the most specific anchor first: the inner content div of the rel editor
        const anchor =
            document.querySelector('.release-rel-editor') ||   // MB React wrapper
            document.querySelector('#content > div') ||        // generic first content div
            document.querySelector('#content');                 // fallback: content root
        if (!anchor) return setTimeout(insertBar, 300);
        anchor.insertBefore(bar, anchor.firstChild);
    }
    insertBar();
}

// ── Instant relationship dispatch engine ─────────────────────────────────────
// Based on kellnerd's bookmarklets: https://github.com/kellnerd/musicbrainz-scripts
// MB.relationshipEditor.dispatch() injects relationships directly into React state.

const REL_TEMPLATE = {
    _lineage: [],
    _original: null,
    _status: 1,
    attributes: null,
    begin_date: null,
    editsPending: false,
    end_date: null,
    ended: false,
    entity0_credit: '',
    entity1_credit: '',
    id: null,
    linkOrder: 0,
    linkTypeID: null,
};

/** Poll for MB.relationshipEditor.state.entity with verbose log feedback. */
async function waitForMBEditor(timeoutMs = 15000) {
    addLogLine('Waiting for MB relationship editor…');
    let waited = 0;
    while (waited < timeoutMs) {
        const MB = pageWindow.MB;
        const re = MB?.relationshipEditor;
        const st = re?.state;
        if (st?.entity) {
            addLogLine(`Editor ready (${waited}ms). Release: "${st.entity.name}"`);
            return re;
        }
        if (waited % 2000 === 0 && waited > 0) {
            const mbKeys = MB ? Object.keys(MB).join(', ') : 'undefined';
            const reKeys = re ? Object.keys(re).join(', ') : 'undefined';
            const stKeys = st ? Object.keys(st).join(', ') : 'undefined';
            addLogLine(`[${waited}ms] MB={${mbKeys}} re={${reKeys}} state={${stKeys}}`);
        }
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    addLogLine('<span style="color:red">ERR MB editor not ready after 15s — aborting</span>');
    return null;
}

/** Fetch a full MB entity from /ws/js/entity/{mbid}. */
async function fetchMBEntity(mbid) {
    const res = await fetch(`/ws/js/entity/${mbid}`);
    if (!res.ok) throw new Error(`/ws/js/entity/${mbid} → ${res.status}`);
    return res.json();
}

/**
 * Resolve a link type name to its numeric ID from MB.linkedEntities.link_type.
 * Tries (in order):
 *   1. Exact name + entity type pair match
 *   2. Exact name only
 *   3. Partial/contains match with entity type pair (handles minor wording differences)
 * Logs available types for the entity pair when nothing matches.
 */
function resolveLinkTypeId(name, type0, type1) {
    const lt = pageWindow.MB?.linkedEntities?.link_type;
    if (!lt) { addLogLine('<span style="color:red">ERR MB.linkedEntities.link_type not available</span>'); return null; }
    const lower = name.toLowerCase().trim();

    // 1. Exact name + entity type pair
    for (const v of Object.values(lt)) {
        if (v.name.toLowerCase() === lower && v.type0 === type0 && v.type1 === type1) return v.id;
    }
    // 2. Exact name, any entity types
    for (const v of Object.values(lt)) {
        if (v.name.toLowerCase() === lower) return v.id;
    }
    // 3. Partial match constrained to entity type pair — prefer longer (more specific) names
    const fuzzyMatches = Object.values(lt).filter(v =>
        v.type0 === type0 && v.type1 === type1 &&
        (v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase()))
    );
    if (fuzzyMatches.length > 0) {
        fuzzyMatches.sort((a, b) => b.name.length - a.name.length);
        const best = fuzzyMatches[0];
        if (best.name.toLowerCase() !== lower) addLogLine(`Fuzzy match: "${name}" → "${best.name}" (${type0}→${type1})`);
        return best.id;
    }

    // Nothing found — log available types for this pair to help diagnose
    const available = Object.values(lt)
        .filter(v => v.type0 === type0 && v.type1 === type1)
        .map(v => v.name)
        .sort()
        .join(', ');
    // Also log exact matches regardless of type pair (to diagnose type0/type1 mismatch)
    const anyMatch = Object.values(lt).filter(v => v.name.toLowerCase() === lower);
    if (anyMatch.length > 0) {
        addLogLine(`<span style="color:orange">WARN Link type "${name}" exists but wrong entity types: ${anyMatch.map(v => `${v.name}(${v.type0}→${v.type1})`).join(', ')} — tried (${type0}→${type1})</span>`);
    } else {
        addLogLine(`<span style="color:orange">WARN Unknown link type "${name}" (${type0}→${type1}). Available: ${available || 'none'}</span>`);
    }
    return null;
}


/**
 * Dispatch one relationship into MB's React editor state.
 * sourceEntity and targetEntity are full MB entity objects (from /ws/js/entity/).
 * credit is the "credited as" string (may be empty).
 * attributes is an ImmutableTree or null.
 */
function dispatchRelationship(re, sourceEntity, targetEntity, linkTypeID, credit, attributes, trackPos) {
    const swapped = sourceEntity.entityType > targetEntity.entityType;
    const e0 = swapped ? targetEntity : sourceEntity;
    const e1 = swapped ? sourceEntity : targetEntity;
    // Resolve link type name and attribute values for the log
    const ltEntry = pageWindow.MB?.linkedEntities?.link_type?.[linkTypeID];
    const ltName = ltEntry ? ltEntry.name : linkTypeID;
    let attrDesc = '';
    if (attributes) {
        try {
            const parts = [];
            for (const a of pageWindow.MB.tree.iterate(attributes)) {
                const n = a.type?.name || a.typeID;
                const v = a.text_value ? `=${a.text_value}` : '';
                if (n) parts.push(n + v);
            }
            if (parts.length) attrDesc = ` [${parts.join(', ')}]`;
        } catch(e) {}
    }
    const posLabel = (trackPos != null && trackPos !== '') ? ` <span style="color:#888;font-size:0.85em">#${trackPos}</span>` : '';
    addLogLine(`→ <strong>${ltName}</strong>${attrDesc}${posLabel}: ${sourceEntity.name || sourceEntity.gid} ↔ ${targetEntity.name || targetEntity.gid}${credit && credit !== (targetEntity.name || targetEntity.gid) ? ` (credited: ${credit})` : ''}`);
    re.dispatch({
        type: 'update-relationship-state',
        sourceEntity,
        batchSelectionCount: null,
        creditsToChangeForSource: '',
        creditsToChangeForTarget: '',
        oldRelationshipState: null,
        newRelationshipState: {
            ...REL_TEMPLATE,
            entity0: e0,
            entity0_credit: swapped ? (credit || '') : '',
            entity1: e1,
            entity1_credit: swapped ? '' : (credit || ''),
            id: re.getRelationshipStateId(),
            linkTypeID,
            attributes: attributes || null,
        },
    });
}

/**
 * Build an MB attribute ImmutableTree from a mixed attributes array.
 * Handles:
 *   - strings: 'additional', 'guest', 'solo' → checkbox attributes
 *   - functions: extract the value they would set via toString() parsing
 *     (legacy format: () => setValueOnAutocomplete(selector, value) or setNativeValue(el, value))
 */
function buildAttributes(rawAttributes) {
    if (!rawAttributes || rawAttributes.length === 0) return null;
    const MB = pageWindow.MB;
    const tree = MB?.tree;
    const lat = MB?.linkedEntities?.link_attribute_type;
    if (!tree || !lat) return null;

    function findAttrByName(name) {
        const lower = name.toLowerCase().trim();
        // Exact match
        for (const v of Object.values(lat)) {
            if (v.name?.toLowerCase() === lower) return v;
        }
        // Partial/root match — e.g. "drums" may be under a parent "drum kit" or vice versa
        // Also handles MB storing "drum kit" while Discogs says "drums"
        for (const v of Object.values(lat)) {
            const vl = v.name?.toLowerCase() || '';
            if (vl.includes(lower) || lower.includes(vl)) return v;
        }
        addLogLine(`<span style="color:orange">WARN Attribute not found in MB: "${name}"</span>`);
        return null;
    }

    // Extract string value from a legacy function attribute by inspecting its source
    function extractFnValue(fn) {
        const src = fn.toString();
        // Match: setValueOnAutocomplete(SELECTORS.X, 'value') or setNativeValue(el, 'value')
        const m = src.match(/,\s*['"`]([^'"`]+)['"`]\s*\)/);
        return m ? m[1] : null;
    }

    const attrObjs = [];
    const seen = new Set();
    for (const attr of rawAttributes) {
        let attrName = null;
        let textValue = '';
        if (typeof attr === 'string') {
            // Checkbox-style: 'additional', 'guest', 'solo'
            attrName = attr;
        } else if (attr && typeof attr === 'object' && attr._type) {
            // Structured: { _type: 'instrument'|'vocal'|'task', value: '...' }
            if (attr._type === 'task') {
                // Task is a free-text attribute — look up the "task" type, set text_value
                attrName = 'task';
                textValue = attr.value;
            } else {
                attrName = attr.value;
            }
        } else if (typeof attr === 'function') {
            // Legacy function attribute — extract quoted string from source
            attrName = extractFnValue(attr);
        }
        if (!attrName) continue;
        const found = findAttrByName(attrName);
        if (!found || seen.has(found.id)) continue;
        seen.add(found.id);
        attrObjs.push({ type: found, typeID: found.id, credited_as: '', text_value: textValue });
    }
    if (attrObjs.length === 0) return null;
    attrObjs.sort((a, b) => a.typeID - b.typeID);
    try {
        return tree.fromDistinctAscArray(attrObjs);
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN Attribute tree build failed (${e.message}) — importing without attributes</span>`);
        return null;
    }
}

/**
 * Master instant fill: processes all companies, release-level artists, and
 * tracklist artists via direct dispatch. Skips duplicates silently.
 * Updates edit note on completion.
 */
/**
 * Fetch JSON with exponential backoff on 429/503, up to retries attempts.
 * Used everywhere WS2 requests are made to handle rate limiting gracefully.
 */
// Session-level URL check cache (avoids localStorage key mismatches across sessions)
const _urlCheckSessionCache = new Map();

// Clean up stale/large localStorage entries from old script versions on startup
(function cleanupLocalStorage() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            // Remove old full-JSON Discogs release caches
            if (k.startsWith('discogs-release-')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
})();

// Module-level IDB cache read (used by showReviewTable to pre-load names)
function readIdbRecord(key) {
    return new Promise(resolve => {
        if (!key || !db) return resolve(null);
        try {
            const tx = db.transaction(['mblinks'], 'readonly');
            const req = tx.objectStore('mblinks').get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror  = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}

// ── Centralized MB API throttle ──────────────────────────────────────────
// All MB API requests go through this single queue to avoid 503 storms.
// Starts fast, slows on 503, reads Retry-After, speeds up on success.
const mbThrottle = (() => {
    let _chain = Promise.resolve();
    let _gap = 250;          // ms between requests — start optimistic
    const MIN_GAP = 200;
    const MAX_GAP = 3000;
    let _totalRequests = 0;
    let _rateLimited = 0;

    function _enqueue(url, retries, wantJson) {
        return new Promise((resolve) => {
            _chain = _chain.then(async () => {
                for (let attempt = 0; attempt <= retries; attempt++) {
                    _totalRequests++;
                    try {
                        const res = await fetch(url);
                        if (res.status === 429 || res.status === 503) {
                            _rateLimited++;
                            const ra = parseInt(res.headers.get('Retry-After'), 10);
                            const waitMs = (ra > 0) ? ra * 1000 : Math.min(2000 * Math.pow(2, attempt), 30000);
                            _gap = Math.min(_gap * 2, MAX_GAP);
                            await new Promise(r => setTimeout(r, waitMs));
                            continue;
                        }
                        if (!res.ok) { resolve(null); return; }
                        // Success — gradually speed up
                        _gap = Math.max(Math.floor(_gap * 0.85), MIN_GAP);
                        const result = wantJson ? await res.json() : res;
                        resolve(result);
                        // Wait gap before next queued request starts
                        await new Promise(r => setTimeout(r, _gap));
                        return;
                    } catch (e) {
                        if (attempt === retries) { resolve(null); return; }
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
                resolve(null);
            });
        });
    }

    return {
        fetchJson: (url, retries = 3) => _enqueue(url, retries, true),
        fetchRaw:  (url, retries = 3) => _enqueue(url, retries, false),
        stats: () => ({ total: _totalRequests, rateLimited: _rateLimited, gap: _gap }),
    };
})();

async function fetchWithRetry(url, retries = 4) {
    return mbThrottle.fetchJson(url, retries);
}


async function instantFillRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorks, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap) {
    resolvedEntityTypes = resolvedEntityTypes || new Map();
    confirmedMap = confirmedMap || new Map();
    const re = await waitForMBEditor();
    if (!re) return;

    const MB = pageWindow.MB;
    const releaseEntity = re.state.entity;
    let added = 0, skipped = 0, failed = 0;
    // Track dispatched relationships this session to catch same-run duplicates
    const dispatchedThisSession = new Set(); // "sourceGid|linkTypeID|targetGid"

    // Link types that belong on recordings, not the release
    // (used for both the "skip at release level" and "move to tracks" logic)
    const RECORDING_LINK_TYPES = new Set([
        'performer', 'instrument', 'vocal', 'vocals', 'orchestra', 'conductor',
        'concertmaster', 'chorus master', 'producer', 'engineer', 'mix',
        'recording', 'remixer', 'DJ-mixer', 'additional', 'guest',
        'programming',
    ]);

    addLogLine(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);

    const bar = document.querySelector('.discogs-bar');
    function tickProgress() {
        const done = added + skipped + failed;
        const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
        const pct = Math.min(Math.round((done / est) * 99), 99);
        const _pct = document.querySelector('#discogs-progress-pct');
        if (_pct) _pct.textContent = pct + '%';
    }

    // ── Build recording maps from MB editor state ────────────────────────────
    const recordingByGid      = new Map(); // gid      → recording entity
    const recordingByPosition = new Map(); // "1"/"A1" → recording entity (fallback for unlinked tracks)
    const editorWorkByRecGid  = new Map(); // recGid   → work entity (from editor state relatedWorks)
    const positionByGid       = new Map(); // recGid   → track position string
    let trackCount = 0;
    try {
        let mediumIndex = 0;
        for (const [mediumKey, medium] of MB.tree.iterate(re.state.mediums)) {
            mediumIndex++;
            const tracks = medium?.tracks ?? medium;
            let trackIndex = 0;
            for (const rawTrack of MB.tree.iterate(tracks)) {
                const trackObj = Array.isArray(rawTrack) ? rawTrack[1] : rawTrack;
                const trackKey = Array.isArray(rawTrack) ? rawTrack[0] : null;
                const rec = trackObj?.recording ?? trackObj;

                if (!rec) continue;
                trackCount++;
                if (rec.gid) {
                    recordingByGid.set(rec.gid, rec);
                    // Store compound position for multi-medium releases
                    positionByGid.set(rec.gid, `${mediumIndex}-${trackIndex + 1}`);
                    // relatedWorks on the track wrapper contains works already linked in the editor
                    const rw = trackObj?.relatedWorks;
                                    if (rw && rw.size > 0) {
                        try {
                            for (const entry of MB.tree.iterate(rw)) {
                                // Each entry is {isSelected, targetTypeGroups, work}
                                const raw = Array.isArray(entry) ? entry[1] : entry;
                                const work = raw?.work ?? raw;
                                if (work?.gid || work?.id) {
                                    editorWorkByRecGid.set(rec.gid, work);
                                    break;
                                }
                            }
                        } catch(e) {}
                    }
                }
                const positions = new Set([
                    trackObj?.position, trackObj?.number,
                    rec?.position, rec?.number,
                    trackKey, trackIndex + 1,
                    // Compound keys: "mediumIndex-trackPosition"
                    `${mediumIndex}-${trackIndex + 1}`,
                    trackObj?.position != null ? `${mediumIndex}-${trackObj.position}` : null,
                    trackObj?.number != null ? `${mediumIndex}-${trackObj.number}` : null,
                ].filter(x => x != null).map(String));
                for (const p of positions) recordingByPosition.set(p, rec);
                trackIndex++;
            }
        }
            + tracklistRels.length
            + 1;
        addLogLine(`Found ${trackCount} track(s) in editor state (${recordingByGid.size} with GID, ${recordingByPosition.size} position entries: ${[...recordingByPosition.keys()].join(',')}). relatedWorks: ${editorWorkByRecGid.size} pre-linked`)
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN Iterating MB state: ${e.message}</span>`);
    }

    // ── Fetch position→GID map from WS2 (authoritative, always correct) ──────
    const positionToGid = new Map(); // "1" / "A1" → recording GID
    try {
        const relMbid = releaseEntity.gid;
        addLogLine(`WS2: fetching recordings for release ${relMbid}…`);
        const wsJson = await fetchWithRetry(`/ws/2/release/${relMbid}?inc=recordings&fmt=json`);
        addLogLine(`WS2: response received`);
        if (wsJson) {
            const mediaCount = wsJson.media?.length ?? 0;
            addLogLine(`WS2: ${mediaCount} medium/media in response`);
            const mediaArr = wsJson.media || [];
            const isMultiMedium = mediaArr.length > 1;
            for (const medium of mediaArr) {
                const medPos = medium.position; // 1-based medium index
                for (const track of (medium.tracks || [])) {
                    const gid = track.recording?.id;
                    if (!gid) continue;
                    // Always add compound "medPos-trackPos" key (Discogs format for multi-disc)
                    if (medPos != null && track.position != null) {
                        positionToGid.set(`${medPos}-${track.position}`, gid);
                    }
                    if (medPos != null && track.number != null) {
                        positionToGid.set(`${medPos}-${track.number}`, gid);
                    }
                    // For single-medium releases also add plain position keys
                    if (!isMultiMedium) {
                        if (track.position != null) positionToGid.set(String(track.position), gid);
                        if (track.number != null)   positionToGid.set(String(track.number), gid);
                    }
                }
            }
            addLogLine(`WS2 position map: ${positionToGid.size} entries (${[...positionToGid.keys()].sort().join(', ')})`);
        }
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN WS2 recording fetch failed: ${e.message} — using editor state positions only</span>`);
    }

    // ── Helper: get recording entity for a Discogs track ─────────────────────
    function getRecordingEntity(track) {
        const rawCandidates = [track.position, String(parseInt(track.position, 10)), track.number].filter(Boolean);
        // For vinyl positions (A1, B2, C3, D4), also try medium-prefixed variants (1-A1, 2-C3)
        // since WS2 returns compound keys for multi-medium releases
        const candidates = [...rawCandidates];
        for (const c of rawCandidates) {
            if (/^[A-Z]/i.test(c)) {
                // Try all medium prefixes — we don't know which medium this side belongs to
                for (let m = 1; m <= 10; m++) {
                    candidates.push(`${m}-${c}`);
                }
            }
        }
        // 1. WS2-based GID lookup (most reliable — linked recordings)
        for (const c of candidates) {
            const gid = positionToGid.get(c);
            if (gid) {
                const rec = recordingByGid.get(gid);
                if (rec) return rec;
                addLogLine(`<span style="color:orange">WARN Recording ${gid} for track ${track.position} not in editor state</span>`);
                return null;
            }
        }
        // 2. Direct position lookup from editor state (unlinked tracks / no recordings yet)
        for (const c of candidates) {
            const rec = recordingByPosition.get(c);
            if (rec) return rec;
        }
        // Nothing found — log what we have so the user can debug
        if (trackCount > 0) {
            const ws2Keys   = positionToGid.size    ? [...positionToGid.keys()].join(', ')    : '(empty)';
            const stateKeys = recordingByPosition.size ? [...recordingByPosition.keys()].join(', ') : '(empty)';
            addLogLine(`<span style="color:orange">WARN No recording for track ${track.position} "${track.title}". WS2 keys: ${ws2Keys} | State keys: ${stateKeys}</span>`);
        }
        return null;
    }

    // ── Helper: resolve MBID from IDB cache for a Discogs entity ─────────────
    async function getMbidForEntity(entity, entityType) {
        return new Promise((resolve, reject) => {
            const key = getDiscogsLinkKey(entity.resource_url);
            if (!key) return reject(`No Discogs key for ${entity.name}`);
            const tx = db.transaction(['mblinks'], 'readonly');
            const req = tx.objectStore('mblinks').get(key);
            req.onsuccess = () => {
                const mbUrl = req.result?.mb_links?.[0];
                if (mbUrl) resolve(mbUrl);
                else reject(`${entity.name} not in IDB cache — run pre-flight check first`);
            };
            req.onerror = () => reject(`IDB error for ${entity.name}`);
        });
    }

    // ── Helper: process one relationship ─────────────────────────────────────
    async function processOne(sourceEntity, entityType0, entityType1, linkTypeName, mbUrl, rawAttributes, credit, trackPos) {
        const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
        if (!mbid) { addLogLine(`<span style="color:red">ERR Bad MBID URL: ${mbUrl}</span>`); failed++; return; }

        const linkTypeID = resolveLinkTypeId(linkTypeName, entityType0, entityType1);
        if (!linkTypeID) {
            addLogLine(`<span style="color:orange">WARN Unknown link type "${linkTypeName}" (${entityType0}→${entityType1}) — skipped</span>`);
            failed++; return;
        }

        const attrTree = buildAttributes(rawAttributes);
        const attrSig = attrTree ? (() => { try { return [...pageWindow.MB.tree.iterate(attrTree)].map(a => a.typeID || '').join(','); } catch(e) { return ''; } })() : '';
        const sessionKey = `${sourceEntity.gid}|${linkTypeID}|${mbid}|${attrSig}`;
        if (dispatchedThisSession.has(sessionKey)) { skipped++; return; }
        dispatchedThisSession.add(sessionKey);

        let targetEntity;
        try {
            targetEntity = await fetchMBEntity(mbid);
        } catch(e) {
            addLogLine(`<span style="color:red">ERR Entity fetch failed for ${mbid}: ${e.message}</span>`);
            failed++; return;
        }

        // Re-resolve link type using the ACTUAL entity type from MB.
        // Entities like recording studios are often stored as labels, not places.
        // Semantic equivalents: some place link types have label counterparts and vice versa.
        const PLACE_TO_LABEL_LINK = {
            'glass mastered at': 'glass mastered',
            'mastered at':       'mastering',
            'pressed at':        'pressed',
            'manufactured at':   'manufactured',
            'recorded at':       'engineer',
            'mixed at':          'mix',
        };
        const LABEL_TO_PLACE_LINK = Object.fromEntries(
            Object.entries(PLACE_TO_LABEL_LINK).map(([k, v]) => [v, k])
        );

        let resolvedLinkTypeID = linkTypeID;
        if (targetEntity.entityType !== entityType1 && targetEntity.entityType !== entityType0) {
            const at = targetEntity.entityType;
            const [rt0, rt1] = at < sourceEntity.entityType ? [at, sourceEntity.entityType] : [sourceEntity.entityType, at];
            let reResolved = resolveLinkTypeId(linkTypeName, rt0, rt1);
            if (!reResolved) {
                // Try semantic equivalent for place↔label entity type switches
                const altName = at === 'label' ? PLACE_TO_LABEL_LINK[linkTypeName]
                                               : LABEL_TO_PLACE_LINK[linkTypeName];
                if (altName) reResolved = resolveLinkTypeId(altName, rt0, rt1);
            }
            if (reResolved) {
                resolvedLinkTypeID = reResolved;
            } else {
                addLogLine(`<span style="color:orange">WARN Entity "${targetEntity.name}" is a ${targetEntity.entityType} but expected ${entityType0}/${entityType1} — link type "${linkTypeName}" may not apply</span>`);
            }
        }

        // Re-check duplicate with the resolved link type ID (may differ from original)

        dispatchRelationship(re, sourceEntity, targetEntity, resolvedLinkTypeID, credit, attrTree, trackPos);
        added++;
    }

    // ── Companies / labels / places ───────────────────────────────────────────
    for (const company of companies) {
        const details = ENTITY_TYPE_MAP[company.entity_type_name];
        if (!details) continue;
        // Use the entity type actually found in MB (e.g. 'label' instead of 'place')
        const resolvedEt = resolvedEntityTypes.get(company.resource_url) || details.entityType;
        // If resolved type doesn't match mapping type, check if the link is valid for that type
        if (resolvedEt !== details.entityType) {
            // MB only supports certain link types per entity type combination.
            // All place-mapped link types are place-only and cannot be used with labels.
            if (details.entityType === 'place' && resolvedEt === 'label') {
                addLogLine(`<span style="color:orange">WARN Skipped ${company.name}: MB has no "${details.linkType}" relationship for labels (only places). Add manually if needed.</span>`);
                skipped++; tickProgress(); continue;
            }
        }
        let mbUrl;
        try { mbUrl = await getMbidForEntity(company, resolvedEt); }
        catch(e) {
            try { mbUrl = await getMbId(company, resolvedEt); }
            catch(e2) { addLogLine(`<span style="color:orange">WARN Skipped ${company.name}: ${e2}</span>`); skipped++; tickProgress(); continue; }
        }
        const et = resolvedEt;
        const [t0, t1] = et <= 'release' ? [et, 'release'] : ['release', et];
        await processOne(releaseEntity, t0, t1, details.linkType, mbUrl, [], '');
        tickProgress();
    }

    // ── Release-level artist roles ────────────────────────────────────────────
    // When "move to tracks" is on, RECORDING_LINK_TYPES roles are skipped here
    // and dispatched only to recordings below — keeping them off the release.
    for (const role of artistRoles) {
        if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType)) continue;
        // Work-only rels (writer, composer, etc.) go to works, not the release
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;

        // Try confirmedMap first (handles artists with no resource_url)
        const _artKey = role.artist.resource_url || role.artist._syntheticKey || `_nourl_${role.artist.name}`;
        let mbUrl = confirmedMap.get(_artKey) || (role.artist.resource_url ? confirmedMap.get(role.artist.resource_url) : null);
        // Name-based fallback: search all confirmedMap keys for _nourl_ match
        if (!mbUrl) {
            for (const [k, v] of confirmedMap) {
                if (k === `_nourl_${role.artist.name}`) { mbUrl = v; break; }
            }
        }
        if (!mbUrl && !role.artist.resource_url) {
            // No Discogs page, not in confirmedMap — skip with clear message
            addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} (${role.linkType}) — no Discogs page, not confirmed in review</span>`);
            skipped++; tickProgress(); continue;
        }
        if (!mbUrl) {
            try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
            catch(e) {
                try { mbUrl = await getMbId(role.artist, 'artist'); }
                catch(e2) {
                    const msg = String(e2);
                    if (msg.includes('was not found in MB')) addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} — not in MB (${role.linkType})</span>`);
                    else addLogLine(`<span style="color:red">ERR Lookup failed for ${role.artist.name}: ${msg}</span>`);
                    skipped++; tickProgress(); continue;
                }
            }
        }
        const credit = role.artist.anv?.trim() || role.artist.name;
        await processOne(releaseEntity, 'artist', 'release', role.linkType, mbUrl, role.attributes || [], credit);
        tickProgress();
    }

    // ── Apply release-level artist credits to all recordings ────────────────
    if (applyToTracks && recordingByGid.size > 0) {
        // Exclude work-only roles — those go to works via the works section below
        const applicable = artistRoles.filter(role => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType));
        if (applicable.length > 0) {
            addLogLine(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)…`);
            for (const role of applicable) {
                let mbUrl;
                try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
                catch(e) {
                    try { mbUrl = await getMbId(role.artist, 'artist'); }
                    catch(e2) {
                        addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} (${role.linkType}) in applyToTracks: ${String(e2).substring(0,80)}</span>`);
                        continue;
                    }
                }
                const credit = role.artist.anv?.trim() || role.artist.name;
                for (const recEntity of recordingByGid.values()) {
                    await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || '*');
                }
            }
        }
    }

    // ── Work-only tracklist relationships (composer, lyricist, arranger etc.) ──
    // recordingOfLinkTypeId: the "recording of" / "performance" link type
    const recordingOfLinkTypeId = resolveLinkTypeId('performance', 'recording', 'work');

    // Collect work-only tracklist rels grouped by recording GID
    const workOnlyByGid = new Map(); // recGid → [{ role, recEntity }, ...]
    for (const role of tracklistRels) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
            addLogLine(`<span style="color:red">ERR Work-only rel for track ${role.track.position} "${role.track.title}" — no recording found, skipped</span>`);
            failed++;
            continue;
        }
        if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
        workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
    }

    // Release-level work-only roles apply to all recordings — only when createWorks is on
    if (createWorks) {
        for (const role of artistRoles) {
            if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
            for (const recEntity of recordingByGid.values()) {
                const syntheticRole = { ...role, track: { position: '', title: recEntity.name || '' } };
                if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
                workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
            }
        }
    }

    // When createWorks is ON, also ensure all recordings have a work —
    // even those with no work-only artist relationships.
    if (createWorks && recordingOfLinkTypeId) {
        for (const recEntity of recordingByGid.values()) {
            if (!workOnlyByGid.has(recEntity.gid)) {
                workOnlyByGid.set(recEntity.gid, []); // empty roles — work creation only
            }
        }
    }

    if (workOnlyByGid.size > 0) {
        if (!recordingOfLinkTypeId) {
            addLogLine('<span style="color:red">ERR Could not resolve "performance" link type — work processing skipped</span>');
        } else {
            addLogLine(`Processing work relationships for ${workOnlyByGid.size} recording(s)…`);

            // Use editor state relatedWorks (built during recording map phase above) — no extra fetch needed
            const existingWorkByRecGid = editorWorkByRecGid;
            addLogLine(`Editor state: ${existingWorkByRecGid.size} recording(s) already have a linked work`);

            // Check editor state only for relationships dispatched in THIS session
            function getWorkFromEditorState(recEntity) {
                try {
                    for (const rel of MB.tree.iterate(recEntity.relationships)) {
                        if (rel._status === 1 && rel.linkTypeID === recordingOfLinkTypeId) {
                            return rel.entity0?.entityType === 'work' ? rel.entity0 : rel.entity1;
                        }
                    }
                } catch(e) {}
                return null;
            }

            for (const [recGid, entries] of workOnlyByGid) {
                // entries may be empty when createWorks adds all recordings (no work-only roles)
                const recEntity  = entries[0]?.recEntity  ?? recordingByGid.get(recGid);
                const trackTitle = entries[0]?.role.track.title    ?? recEntity?.name ?? recGid;
                const trackPos   = entries[0]?.role.track.position ?? '';
                if (!recEntity) continue;

                // Check for pre-existing works using MB's own relatedWorks field on the track wrapper
                // (mirrors MB's batch-create-works logic: `if (relatedWorks.size !== 0) continue`)
                const hasExistingWork = editorWorkByRecGid.has(recGid);

                let workEntity = null;
                if (hasExistingWork) {
                    workEntity = editorWorkByRecGid.get(recGid);
                    const wid = workEntity.gid || workEntity.id;
                    addLogLine(`Track ${trackPos} "${trackTitle}": work already linked (${workEntity.name || wid || 'existing'}) — skipping creation`);
                    if (!workEntity.gid && !workEntity.id) continue; // can't use this entity
                }

                // Also check for works dispatched in this session (newly created ones)
                if (!workEntity) workEntity = getWorkFromEditorState(recEntity);

                // 3. No work found
                if (!workEntity) {
                    if (!createWorks) {
                        // Log as error — work-only rels cannot be applied without a work
                        for (const { role } of entries) {
                            addLogLine(`<span style="color:red">ERR Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) — enable "Create missing works" or add work manually</span>`);
                            failed++;
                        }
                        continue;
                    }

                    // Use MB's own batch-create-works mechanism:
                    // 1. Build work object matching MB's createWorkObject() output
                    // 2. Register it via mergeLinkedEntities so the editor knows about it
                    // 3. Dispatch the recording→work relationship
                    const MB = pageWindow.MB;
                    const newWorkId = re.getRelationshipStateId(); // negative unique ID
                    workEntity = {
                        _fromBatchCreateWorksDialog: true,
                        attributes: [],
                        comment: '',
                        editsPending: false,
                        entityType: 'work',
                        gid: null,
                        id: newWorkId,
                        iswcs: [],
                        languages: [],
                        name: trackTitle,
                        typeID: null,
                    };
                    // Register the new work entity in MB's linked entities store
                    // (mirrors what MB does before dispatching batch-created works)
                    if (MB.mergeLinkedEntities) {
                        MB.mergeLinkedEntities({ work: { [newWorkId]: workEntity } });
                    }
                    // Dispatch recording→work relationship using MB's own relationship structure
                    re.dispatch({
                        type: 'update-relationship-state',
                        sourceEntity: recEntity,
                        batchSelectionCount: null,
                        creditsToChangeForSource: '',
                        creditsToChangeForTarget: '',
                        oldRelationshipState: null,
                        newRelationshipState: {
                            _lineage: ['batch-created work'],
                            _original: null,
                            _status: 1,
                            attributes: null,
                            begin_date: null,
                            editsPending: false,
                            end_date: null,
                            ended: false,
                            entity0: recEntity,
                            entity0_credit: '',
                            entity1: workEntity,
                            entity1_credit: '',
                            id: re.getRelationshipStateId(),
                            linkOrder: 0,
                            linkTypeID: recordingOfLinkTypeId,
                        },
                    });
                    addLogLine(`Track ${trackPos} "${trackTitle}": created new work "${trackTitle}"`);
                    added++;
                    tickProgress();
                    // Re-read from editor state so subsequent artist→work dispatches see the live entity
                    workEntity = getWorkFromEditorState(recEntity) || workEntity;
                }

                // Apply all work-only artist rels to the work
                for (const { role } of entries) {
                    let mbUrl;
                    try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
                    catch(e) {
                        try { mbUrl = await getMbId(role.artist, 'artist'); }
                        catch(e2) {
                            const msg = String(e2);
                            if (msg.includes('was not found in MB')) addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} — not in MB (${role.linkType})</span>`);
                            else addLogLine(`<span style="color:red">ERR Lookup failed for ${role.artist.name}: ${msg}</span>`);
                            continue;
                        }
                    }
                    const credit = role.artist.anv?.trim() || role.artist.name;
                    if (workEntity.gid) {
                        await processOne(workEntity, 'artist', 'work', role.linkType, mbUrl, role.attributes || [], credit, trackPos || (entries[0]?.role?.track?.position));
                    } else {
                        // New work (no MBID yet) — dispatch directly with the provisional entity
                        const linkTypeID = resolveLinkTypeId(role.linkType, 'artist', 'work');
                        if (linkTypeID) {
                            const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                            try {
                                const artistEntity = await fetchMBEntity(mbid);
                                dispatchRelationship(re, workEntity, artistEntity, linkTypeID, credit, buildAttributes(role.attributes || []));
                                added++;
                            } catch(e) {
                                addLogLine(`<span style="color:red">ERR Failed to add ${role.linkType} for new work: ${e.message}</span>`);
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Tracklist non-work artist roles ───────────────────────────────────────
    const seenTrackRels = new Set();
    for (const role of tracklistRels) {
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue; // handled above

        // Try confirmedMap first (handles artists with no resource_url)
        const _tArtKey = role.artist.resource_url || role.artist._syntheticKey || `_nourl_${role.artist.name}`;
        let mbUrl = confirmedMap.get(_tArtKey) || (role.artist.resource_url ? confirmedMap.get(role.artist.resource_url) : null);
        if (!mbUrl) {
            for (const [k, v] of confirmedMap) {
                if (k === `_nourl_${role.artist.name}`) { mbUrl = v; break; }
            }
        }
        if (!mbUrl && !role.artist.resource_url) {
            addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} on track ${role.track.position} — no Discogs page, not confirmed</span>`);
            continue;
        }
        if (!mbUrl) {
            try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
            catch(e) {
                try { mbUrl = await getMbId(role.artist, 'artist'); }
                catch(e2) {
                    const msg = String(e2);
                    if (msg.includes('was not found in MB')) addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} on track ${role.track.position} — not in MB</span>`);
                    else addLogLine(`<span style="color:red">ERR Lookup failed for ${role.artist.name} on track ${role.track.position}: ${msg}</span>`);
                    continue;
                }
            }
        }

        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
            addLogLine(`<span style="color:orange">WARN No recording found for track ${role.track.position} "${role.track.title}" — skipped</span>`);
            failed++; continue;
        }

        const credit = role.artist.anv?.trim() || role.artist.name;
        const attrKey = (role.attributes||[]).map(a=>a.value||a._type||'').join(',');
        const trackRelKey = `${role.track.position}|${role.linkType}|${mbUrl}|${attrKey}`;
        if (seenTrackRels.has(trackRelKey)) continue;
        seenTrackRels.add(trackRelKey);
        addLogLine(`Track ${role.track.position} "${role.track.title}": adding <strong>${role.linkType}</strong> — ${credit}`);
        await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, role.track.position);
        tickProgress();
    }

    // ── Update edit note ──────────────────────────────────────────────────────
    try {
        const opts = [
            processTracklist !== undefined ? `per-track:${processTracklist ? 'on' : 'off'}` : null,
            applyToTracks   !== undefined ? `move-to-tracks:${applyToTracks ? 'on' : 'off'}` : null,
            createWorks     !== undefined ? `create-works:${createWorks ? 'on' : 'off'}` : null,
        ].filter(Boolean).join(', ');
        const note = buildEditNote(discogsUrl, opts);
        re.dispatch({ type: 'update-edit-note', editNote: note });
    } catch(e) { /* ignore */ }

    addLogLine(`<strong>Done: ${added} added, ${skipped} already existed, ${failed} failed/skipped</strong>`);
}


function addLogLine(message) {
    const li = document.createElement('li');
    li.innerHTML = message;
    logs.insertAdjacentElement('beforeend', li);
    // Feed progress ticker (strip HTML tags for plain-text display)
    const bar = document.querySelector('.discogs-bar');
    if (bar?._setProgress) {
        bar._setProgress(null, message.replace(/<[^>]*>/g, '').trim().substring(0, 120));
    }
}

function hasDiscogsLinkDefined(mbid) {
    let url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    return fetch(url)
        .then(body => {
            return body.json();
        })
        .then(json => {
            const matchingRel = (json.relationships || []).find(rel => {
                return rel.target?.sidebar_name === 'Discogs';
            });
            return matchingRel?.target?.href_url || null;
        });
}

function startImportRels(discogsUrl, processTracklist, applyToTracks, createWorks) {
    return getDiscogsReleaseData(discogsUrl)
        .then(json => {
            let artistRoles = convertDiscogsArtistsToRolesRelationships(json.extraartists?.filter(artist => !artist.tracks));
            // ── Raw Discogs JSON (collapsible, once per log session) ─────────────────
            if (!logs._releaseInfoAdded) {
                logs._releaseInfoAdded = true;
                const trackCount = (json.tracklist || []).filter(t => t.type_ === 'track').length;
                const summary = `${json.title || ''}${json.year ? ' \u00b7 ' + json.year : ''} \u00b7 ${trackCount} tracks`;
                const li = document.createElement('li');
                const pre = document.createElement('pre');
                pre.style.cssText = 'max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;';
                pre.textContent = JSON.stringify(json, null, 2);
                const copyJsonBtn = document.createElement('button');
                copyJsonBtn.textContent = 'Copy JSON';
                copyJsonBtn.style.cssText = 'font-size:0.75rem;padding:0.1rem 0.4rem;cursor:pointer;margin-left:0.5rem;vertical-align:middle;';
                copyJsonBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(JSON.stringify(json, null, 2)).catch(() => {
                        const ta = Object.assign(document.createElement('textarea'), { value: JSON.stringify(json, null, 2) });
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                    });
                    copyJsonBtn.textContent = 'Copied!';
                    setTimeout(() => { copyJsonBtn.textContent = 'Copy JSON'; }, 1500);
                });
                li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} — raw Discogs JSON</strong></summary></details>`;
                li.querySelector('summary').appendChild(copyJsonBtn);
                li.querySelector('details').appendChild(pre);
                logs.appendChild(li);
            }
            addLogLine(`Found ${json.companies.length + artistRoles.length} release relationships`);
            // handle potential dj mixes - if the tracks are the full medium then assign it to the release/medium else leave it as individual tracks
            artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
            let tracklistRels = [];
            if (processTracklist) {
                tracklistRels = json.tracklist
                    .filter(track => track.type_ === 'track')
                    .reduce((map, track) => {
                        if (!track.extraartists || !Array.isArray(track.extraartists)) {
                            return map;
                        }
                        return map.concat(
                            convertDiscogsArtistsToRolesRelationships(track.extraartists).map(rel => {
                                return Object.assign({}, rel, {
                                    track: track,
                                });
                            })
                        );
                    }, []);
                const releaseLevelTracklistRels = json.extraartists?.filter(artist => artist.tracks && artist.tracks !== '') || [];
                if (releaseLevelTracklistRels.length > 0) {
                    tracklistRels = tracklistRels.concat(
                        releaseLevelTracklistRels.reduce((array, artist) => {
                            return array.concat(
                                getAllArtistTracks(json.tracklist, artist.tracks).reduce((array, track) => {
                                    return array.concat(
                                        getArtistRoles(artist).map(rel => {
                                            return Object.assign({}, rel, {
                                                artist: artist,
                                                track: track,
                                            });
                                        })
                                    );
                                }, [])
                            );
                        }, [])
                    );
                }
                addLogLine(`Found ${tracklistRels.length} tracklist relationships`);
            }

            // Collect all unique artist entities referenced across release-level and tracklist roles
            const allArtistRoles = artistRoles.concat(tracklistRels);
            const uniqueArtists = [];
            const seenResourceUrls = new Set();
            // rolesMap: resource_url → [{linkType, trackPos, trackTitle}]
            const rolesMap = new Map();
            allArtistRoles.forEach(role => {
                const url = role.artist?.resource_url || `_nourl_${role.artist?.name || role.artist?.id}`;
                if (!rolesMap.has(url)) rolesMap.set(url, []);
                // Build display label: instrument/vocal name > linkType
                let displayLabel = role.linkType;
                if (role.attributes && role.attributes.length > 0) {
                    const attr = role.attributes[0];
                    if (attr._type === 'instrument' && attr.value) displayLabel = attr.value;
                    else if (attr._type === 'vocal' && attr.value) displayLabel = attr.value;
                    else if (typeof attr === 'string') displayLabel = `${role.linkType} [${attr}]`;
                }
                rolesMap.get(url).push({
                    linkType: role.linkType,
                    displayLabel,
                    trackPos: role.track?.position || '',
                    trackTitle: role.track?.title || '',
                });
                if (!seenResourceUrls.has(url)) {
                    seenResourceUrls.add(url);
                    if (role.artist?.resource_url) getDiscogsLinkKey(role.artist.resource_url);
                    // Attach synthetic key for artists with no Discogs URL
                    if (!role.artist?.resource_url && role.artist) role.artist._syntheticKey = url;
                    uniqueArtists.push(role.artist);
                }
            });
            // Also add company roles to a companiesRolesMap
            const companiesRolesMap = new Map();
            json.companies.forEach(c => {
                if (!c.resource_url) return;
                if (!companiesRolesMap.has(c.resource_url)) companiesRolesMap.set(c.resource_url, []);
                companiesRolesMap.get(c.resource_url).push({ linkType: c.entity_type_name || '' });
            });

            // Pre-flight: check artists and companies, show unified review table.
            const uniqueCompanies = [];
            const seenCompanyUrls = new Set();
            json.companies.forEach(c => {
                if (c.resource_url && !seenCompanyUrls.has(c.resource_url) && ENTITY_TYPE_MAP[c.entity_type_name]) {
                    seenCompanyUrls.add(c.resource_url);
                    getDiscogsLinkKey(c.resource_url);
                    uniqueCompanies.push(c);
                }
            });

            // ── Pre-flight cache ─────────────────────────────────────────
            const PREFLIGHT_CACHE_KEY = `discogs-preflight-${discogsUrl}`;
            const today = new Date().toISOString().slice(0, 10);
            let cachedResults = null;
            try {
                const saved = JSON.parse(localStorage.getItem(PREFLIGHT_CACHE_KEY) || 'null');
                if (saved?.date === today && Array.isArray(saved.results)) {
                    cachedResults = saved.results;
                }
            } catch(e) {}

            function runPreflight(bypassIdb) {
                const artistProgressLi = document.createElement('li');
                artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz…`;
                logs.appendChild(artistProgressLi);

                const companyProgressLi = document.createElement('li');
                companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz…`;
                logs.appendChild(companyProgressLi);

                return Promise.all([
                    checkMissingArtists(uniqueArtists, artistProgressLi, bypassIdb),
                    checkMissingCompanies(uniqueCompanies, companyProgressLi, bypassIdb),
                ]).then(([artistResults, companyResults]) => {
                    const allResults = [...artistResults.allResults, ...companyResults.allResults].filter(Boolean);
                    // Save to cache (only if not bypassing)
                    if (!bypassIdb) try {
                        const slimResults = allResults.map(r => ({
                            type: r.type, entityType: r.entityType || 'artist',
                            displayName: r.displayName || r.entity?.name || '',
                            discogsHref: r.discogsHref || '',
                            rateLimited: r.rateLimited || false,
                            nameMatches: (r.nameMatches || []).slice(0, 5),
                            mbUrl: r.mbUrl || null,
                            // Only save mbName if we actually have it — don't cache null names
                            mbName: r.mbName || null,
                            mbDisambig: r.mbDisambig || '',
                            entity: { resource_url: r.entity?.resource_url, name: r.entity?.name || '', _syntheticKey: r.entity?._syntheticKey || '' },
                        }));
                        localStorage.setItem(PREFLIGHT_CACHE_KEY, JSON.stringify({ date: today, results: slimResults }));
                    } catch(e) { console.warn('Discogs importer: preflight cache save failed', e); }
                    return allResults;
                });
            }

            let capturedResults = null; // shared across promise chain
            let capturedConfirmedMap = null;
            const preflightPromise = cachedResults ? Promise.resolve(cachedResults) : runPreflight();

            return preflightPromise.then(allResults => {
                // Annotate each result with its Discogs roles (works for both cache and fresh)
                allResults.forEach(r => {
                    if (!r) return;
                    const url = r.entity?.resource_url || r.entity?._syntheticKey;
                    if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
                });
                capturedResults = allResults;
                return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
                    isFromCache: !!cachedResults,
                    cacheKey: PREFLIGHT_CACHE_KEY,
                    onRefresh: () => {
                        // Clear session memory cache for this release so data is truly fresh
                        _releaseDataCache.delete(discogsUrl);
                        return runPreflight(true).then(freshResults => {
                        freshResults.forEach(r => {
                            if (!r) return;
                            const url = r.entity?.resource_url || r.entity?._syntheticKey;
                            if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
                        });
                        return freshResults;
                        });
                    },
                });
            })
                .then(confirmedMap => {
                    capturedConfirmedMap = confirmedMap;
                    // Cache every confirmed artist MBID into IDB
                    const cachePromises = [];
                    confirmedMap.forEach((mbUrl, resourceUrl) => {
                        const key = getDiscogsLinkKey(resourceUrl);
                        if (!key) return;
                        cachePromises.push(new Promise(res => {
                            try {
                                const tx = db.transaction(['mblinks'], 'readwrite');
                                tx.oncomplete = res; tx.onerror = res;
                                tx.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl] });
                            } catch (e) { res(); }
                        }));
                    });
                    return Promise.all(cachePromises);
                })
                .then(() => {
                    // Build resolved entity type map from preflight results
                    const resolvedEntityTypes = new Map();
                    (capturedResults || []).forEach(r => {
                        if (r.entity?.resource_url && r.mbUrl && r.entityType) {
                            resolvedEntityTypes.set(r.entity.resource_url, r.entityType);
                        }
                    });
                    return instantFillRelationships(json.companies, artistRoles, tracklistRels, applyToTracks, createWorks, json.tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap);
                });
        })
        .then(() => { });
}

/**
 * Checks each artist against MB using two strategies in sequence:
 *   1. URL-relationship lookup (fast, exact) — the same query the real import uses.
 *      If the Discogs URL is already linked in MB this resolves immediately.
 *   2. Name search fallback — if the URL lookup finds nothing, search by artist name.
 *      A name hit means the artist exists in MB but has no Discogs link yet; the
 *      import will still fail, but the user should link rather than create.
 *
 * Returns an array of objects: { artist, nameMatches }
 *   artist      – the Discogs artist object
 *   nameMatches – array of { id, name, disambiguation } from the MB name search
 *                 (empty array means truly not found → needs creation)
 */
async function checkMissingArtists(artists, progressLi, bypassIdb) {
    const CONCURRENCY = 5;   // worker count (MB requests are serialized via mbThrottle)
    const MIN_GAP_MS  = 50;  // stagger between worker starts (actual MB pacing is in mbThrottle)

    let done = 0;
    let inFlight = 0; // names of artists currently being fetched
    const inFlightNames = new Set();

    function setProgress() {
        if (!progressLi) return;
        const remaining = artists.length - done;
        const checking = inFlightNames.size
            ? ` \u2014 checking <em>${[...inFlightNames].join(', ')}</em>` : '';
        progressLi.innerHTML =
            `Checking artists against MusicBrainz\u2026 ` +
            `<strong>${done}/${artists.length}</strong> done${checking}` +
            (remaining === 0 ? ' \u2714' : ` (${remaining} remaining)`);
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Fetch with automatic retry on 503/429; backs off and retries up to 4 times.
    // Returns parsed JSON or null on permanent failure.
    async function mbFetch(url, retries = 4) {
        return mbThrottle.fetchJson(url, retries);
    }

    function checkIdbCache(key) {
        return new Promise(resolve => {
            if (!key || !db) return resolve(null);
            try {
                const tx = db.transaction(['mblinks'], 'readonly');
                const req = tx.objectStore('mblinks').get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror  = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    }

    async function checkOne(artist) {
        const key         = getDiscogsLinkKey(artist.resource_url);
        const searchName  = artist.name;
        const displayName = (artist.anv && artist.anv.trim()) || artist.name;
        const discogsHref = artist.resource_url
            .replace('https://api.discogs.com/artists/', 'https://www.discogs.com/artist/');

        function resolvedResult(mbUrl, mbName, mbDisambig, via) {
            return { type: 'resolved', entityType: 'artist', entity: artist,
                     displayName, discogsHref, mbUrl, mbName, mbDisambig,
                     logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via } };
        }

        // Fetch MB artist name/disambiguation for a known MBID (for display purposes)
        async function fetchMbArtistInfo(mbUrl) {
            const mbid = mbUrl.replace(/.*\/artist\//, '');
            const json = await mbFetch(`//musicbrainz.org/ws/2/artist/${mbid}?fmt=json`);
            return json ? { name: json.name || null, disambiguation: json.disambiguation || '' } : { name: null, disambiguation: '' };
        }

        // 1. IDB cache — instant, no network (skip for artists with no real key)
        if (!bypassIdb && key) {
            const cachedRec = await checkIdbCache(key);
            if (cachedRec?.mb_links?.[0]) {
                const cached = cachedRec.mb_links[0];
                if (cachedRec.mb_name) {
                    return resolvedResult(cached, cachedRec.mb_name, cachedRec.mb_disambiguation || '', 'cache');
                }
                const info = await fetchMbArtistInfo(cached);
                if (info.name) {
                    try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({...cachedRec, mb_name:info.name, mb_disambiguation:info.disambiguation}); } catch(e){}
                }
                return resolvedResult(cached, info.name, info.disambiguation, 'cache');
            }
        }

        // 2. Name search — resolves newly created artists without a Discogs link yet
        const nameJson = await mbFetch(
            `//musicbrainz.org/ws/2/artist?query=${encodeURIComponent(searchName)}&fmt=json&limit=10`
        );
        const nameSearchFailed = nameJson === null;
        const normalized = searchName.toLowerCase().trim();
        const nameMatches = !nameJson?.artists ? [] : nameJson.artists
            .filter(a => a.name.toLowerCase().trim() === normalized || (a.score != null && a.score >= 70))
            .map(a => ({ id: a.id, name: a.name, disambiguation: a.disambiguation || '', score: a.score || 0 }));

        const exactMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
        if (exactMatches.length === 1) {
            const a = exactMatches[0];
            const mbUrl = `//musicbrainz.org/artist/${a.id}`;
            if (key) {
                try {
                    const tx = db.transaction(['mblinks'], 'readwrite');
                    tx.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl], mb_name: a.name, mb_disambiguation: a.disambiguation || '' });
                } catch(e) { /* ignore duplicate */ }
            }
            return resolvedResult(mbUrl, a.name, a.disambiguation, 'name');
        }

        // 3. URL lookup — needed when name search is ambiguous or empty
        const urlJson = key && link_infos[key] ? await mbFetch(
            `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=artist-rels&fmt=json`
        ) : null;
        if (urlJson?.relations?.length > 0) {
            const rel = urlJson.relations.find(r => r.artist);
            if (rel) {
                const a = rel.artist;
                const mbUrl = `//musicbrainz.org/artist/${a.id}`;
                // rel.artist from the URL endpoint may not include full name details; fetch them
                const info = (a.name) ? a : await fetchMbArtistInfo(mbUrl);
                const resolvedName = info.name || a.name;
                const resolvedDisam = info.disambiguation || a.disambiguation || '';
                if (key && resolvedName) {
                    try {
                        const tx2 = db.transaction(['mblinks'], 'readwrite');
                        tx2.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl], mb_name: resolvedName, mb_disambiguation: resolvedDisam });
                    } catch(e) {}
                }
                return resolvedResult(mbUrl, resolvedName, resolvedDisam, 'url');
            }
        }

        return { type: 'attention', entityType: 'artist', entity: artist,
                 displayName, discogsHref, nameMatches,
                 rateLimited: nameSearchFailed && !nameMatches.length };
    }

    // Concurrency pool: launch up to CONCURRENCY workers simultaneously.
    // Each worker pulls the next artist from the queue, processes it, then loops.
    // A small per-slot stagger (MIN_GAP_MS) avoids thundering-herd on burst start.
    return (async () => {
        const queue   = artists.map((a, i) => ({ artist: a, index: i }));
        const results = new Array(artists.length);

        setProgress();

        async function worker(slotIndex) {
            await delay(slotIndex * MIN_GAP_MS); // stagger slot start
            while (queue.length > 0) {
                const { artist, index } = queue.shift();
                const displayName = (artist.anv && artist.anv.trim()) || artist.name;
                inFlightNames.add(displayName);
                setProgress();

                const result = await checkOne(artist);
                results[index] = result;

                inFlightNames.delete(displayName);
                done++;
                setProgress();
            }
        }

        const slots = Math.min(CONCURRENCY, artists.length);
        await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));

        // Return all results for the unified review table
        // resolved: { type:'resolved', artist, mbUrl, logEntry:{displayName,discogsHref,mbUrl,mbName,mbDisambig,via} }
        // attention: { type:'attention', artist, nameMatches }
        return { allResults: results };
    })();
}

/**
 * Checks companies (labels/places) against MB — same approach as checkMissingArtists.
 * Returns { allResults } with the same unified result shape.
 */
async function checkMissingCompanies(companies, progressLi, bypassIdb) {
    const CONCURRENCY = 5;
    const MIN_GAP_MS  = 200;
    let done = 0;
    const inFlightNames = new Set();

    function setProgress() {
        if (!progressLi) return;
        const remaining = companies.length - done;
        const checking = inFlightNames.size
            ? ` \u2014 checking <em>${[...inFlightNames].join(', ')}</em>` : '';
        progressLi.innerHTML =
            `Checking labels/places against MusicBrainz\u2026 ` +
            `<strong>${done}/${companies.length}</strong> done${checking}` +
            (remaining === 0 ? ' \u2714' : ` (${remaining} remaining)`);
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    async function mbFetch(url, retries = 4) {
        return mbThrottle.fetchJson(url, retries);
    }

    function checkIdbCache(key) {
        return new Promise(resolve => {
            if (!key || !db) return resolve(null);
            try {
                const tx = db.transaction(['mblinks'], 'readonly');
                const req = tx.objectStore('mblinks').get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror  = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    }

    async function checkOne(company) {
        const details = ENTITY_TYPE_MAP[company.entity_type_name];
        if (!details) return null; // unmapped company type — skip
        const entityType  = details.entityType; // 'label' or 'place'
        const key         = getDiscogsLinkKey(company.resource_url);
        const searchName  = company.name;
        const displayName = company.name;
        // API uses plural paths (labels/, masters/) but website uses singular (label/, master/)
        const discogsHref = company.resource_url
            .replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, 'https://www.discogs.com/$1/$2');

        async function fetchMbEntityInfo(mbUrl) {
            const mbid = mbUrl.replace(/.*\/(label|place)\//, '');
            const json = await mbFetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`);
            return json ? { name: json.name || null, disambiguation: json.disambiguation || '' }
                        : { name: null, disambiguation: '' };
        }

        // 1. IDB cache — use stored name if available (skip when bypassIdb)
        if (!bypassIdb) {
            const cachedRec = await checkIdbCache(key);
            if (cachedRec?.mb_links?.[0]) {
                const cached = cachedRec.mb_links[0];
                if (cachedRec.mb_name) {
                    return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                             mbUrl: cached, mbName: cachedRec.mb_name, mbDisambig: cachedRec.mb_disambiguation || '',
                             logEntry: { displayName, discogsHref, mbUrl: cached, mbName: cachedRec.mb_name,
                                         mbDisambig: cachedRec.mb_disambiguation || '', via: 'cache' } };
                }
                const info = await fetchMbEntityInfo(cached);
                if (info.name) {
                    try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({...cachedRec, mb_name:info.name, mb_disambiguation:info.disambiguation}); } catch(e){}
                }
                return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                         mbUrl: cached, mbName: info.name, mbDisambig: info.disambiguation,
                         logEntry: { displayName, discogsHref, mbUrl: cached, mbName: info.name,
                                     mbDisambig: info.disambiguation, via: 'cache' } };
            }
        }

        // 2. Name search
        const nameJson = await mbFetch(
            `//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(searchName)}&fmt=json&limit=8`
        );
        const resultKey = entityType === 'label' ? 'labels' : 'places';
        const normalized = searchName.toLowerCase().trim();
        const nameSearchFailed2 = nameJson === null;
        const nameMatches = !(nameJson?.[resultKey]) ? [] : nameJson[resultKey]
            .filter(a => a.name.toLowerCase().trim() === normalized || (a.score != null && a.score >= 70))
            .map(a => ({ id: a.id, name: a.name, disambiguation: a.disambiguation || a['disambiguation-comment'] || '', score: a.score || 0 }));

        const exactMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
        if (exactMatches.length === 1) {
            const a = exactMatches[0];
            const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
            if (key) {
                try {
                    const tx = db.transaction(['mblinks'], 'readwrite');
                    tx.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl] });
                } catch(e) {}
            }
            if (key) try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({discogs_id:key, mb_links:[mbUrl], mb_name:a.name, mb_disambiguation:a.disambiguation||''}); } catch(e){}
            return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                     mbUrl, mbName: a.name, mbDisambig: a.disambiguation,
                     logEntry: { displayName, discogsHref, mbUrl, mbName: a.name,
                                 mbDisambig: a.disambiguation, via: 'name' } };
        }

        // 3. URL lookup — for places also try label-rels (facilities are often stored as labels in MB)
        const incRels = entityType === 'place' ? 'place-rels+label-rels' : `${entityType}-rels`;
        const urlJson = key && link_infos[key] ? await mbFetch(
            `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=${incRels}&fmt=json`
        ) : null;
        if (urlJson?.relations?.length > 0) {
            const rel = urlJson.relations.find(r => r[entityType] || r['label'] || r['place']);
            if (rel) {
                const actualEt = rel[entityType] ? entityType : (rel['label'] ? 'label' : 'place');
                const a = rel[actualEt];
                const mbUrl = `//musicbrainz.org/${actualEt}/${a.id}`;
                const info = a.name ? a : await fetchMbEntityInfo(mbUrl);
                return { type: 'resolved', entityType: actualEt, entity: company, displayName, discogsHref,
                         mbUrl, mbName: info.name || a.name, mbDisambig: info.disambiguation || '',
                         logEntry: { displayName, discogsHref, mbUrl,
                                     mbName: info.name || a.name, mbDisambig: info.disambiguation || '', via: 'url' } };
            }
        }

        return { type: 'attention', entityType, entity: company, displayName, discogsHref, nameMatches };
    }

    return (async () => {
        const queue   = companies.map((c, i) => ({ company: c, index: i }));
        const results = [];
        // Use index from queue item instead of resource_url Map (avoids collision for duplicate URLs)
        const resultArr = new Array(companies.length);
        setProgress();

        async function worker(slotIndex) {
            await delay(slotIndex * MIN_GAP_MS);
            while (queue.length > 0) {
                const _item = queue.shift();
                const company = _item.company || _item;
                const _cIdx = _item.index ?? -1;
                inFlightNames.add(company.name);
                setProgress();
                const result = await checkOne(company);
                if (result && _cIdx >= 0) resultArr[_cIdx] = result;
                inFlightNames.delete(company.name);
                done++;
                setProgress();
            }
        }

        const slots = Math.min(CONCURRENCY, companies.length);
        if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));
        return { allResults: resultArr.filter(Boolean) };
    })();
}


/**
 * Replicates MusicBrainz's "Guess sort name" button logic for artist names.
 * Rules (from https://musicbrainz.org/doc/Style/Artist/Sort_Name):
 *   - Groups starting with an article (The, A, An) → move article to end
 *   - Person names → "Last, First" (last word becomes family name)
 *   - Prefixes like "DJ ", "MC ", "Dr. " treated as part of given name (stay at front after comma)
 *   - Suffixes like "Jr.", "Sr.", "III" stay at the end
 *   - Single-word names → unchanged
 *
 * This is intentionally a best-effort heuristic; MB's own button has the same limitations
 * and editors are expected to review the result.
 */
function guessSortName(name) {
    if (!name || !name.trim()) return name;
    name = name.trim();

    // Articles that move to the end for group names
    const articleRe = /^(the|a|an)\s+(.+)$/i;

    // Honorific/title prefixes that are treated as part of the given name
    const honorifics = /^(dr\.?|prof\.?|sir|lady|lord|rev\.?|st\.?|dj|mc|mc\.?)\s+/i;

    // Suffixes that stay at the end after the given name
    const suffixRe = /^(.*?),?\s+(jr\.?|sr\.?|ii|iii|iv|v|esq\.?)$/i;

    // Split into words for analysis
    const words = name.split(/\s+/);

    // Single word → no change
    if (words.length === 1) return name;

    // --- Check for article prefix (group name heuristic) ---
    // Only treat as a group if it's an article + multiple remaining words,
    // AND the name doesn't look like a person name (e.g. "The" followed by what
    // looks like "Firstname Lastname" still gets treated as a group).
    const articleMatch = name.match(articleRe);
    if (articleMatch) {
        const article = articleMatch[1];
        const rest    = articleMatch[2];
        // If rest is a single word, it's clearly a group: "The Doors" → "Doors, The"
        // If rest is two+ words, it could be "The John Smith Band" — treat as group too
        return `${rest}, ${article.charAt(0).toUpperCase() + article.slice(1).toLowerCase()}`;
    }

    // --- Person name heuristic ---
    // Extract any trailing suffix
    let suffix = '';
    let baseName = name;
    const suffixMatch = name.match(suffixRe);
    if (suffixMatch) {
        baseName = suffixMatch[1].trim();
        suffix   = ' ' + suffixMatch[2];
    }

    const baseWords = baseName.split(/\s+/);
    if (baseWords.length === 1) return name; // single word after suffix strip

    // Last word is the family name
    const familyName = baseWords[baseWords.length - 1];
    const givenPart  = baseWords.slice(0, -1).join(' ');

    return `${familyName}, ${givenPart}${suffix}`;
}



/**
 * Unified artist review table shown after the pre-flight check.
 * ALL artists appear here — auto-resolved ones are pre-filled and editable,
 * attention-needed ones are highlighted orange with search + create actions.
 *
 * Returns a Promise that resolves with a Map<resource_url, mbUrl> of every
 * artist the user has confirmed (or left as auto-matched). The import never
 * starts until the user explicitly clicks "Start import".
 */
async function showReviewTable(allResults, rolesMap, companiesRolesMap, opts) {
    rolesMap = rolesMap || new Map();
    companiesRolesMap = companiesRolesMap || new Map();
    const isFromCache = opts?.isFromCache || false;
    const cacheKey = opts?.cacheKey || null;
    const onRefresh = opts?.onRefresh || null;

    // Pre-load missing names into a Map — IDB first, then MB WS2 fetch.
    const _preloadedNames = new Map();
    const _nullNames = allResults.filter(r => r.type === 'resolved' && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
        const rUrl = r.entity?.resource_url;
        try {
            const idbKey = getDiscogsLinkKey(rUrl);
            const rec = await readIdbRecord(idbKey);
            if (rec?.mb_name) {
                _preloadedNames.set(rUrl, { name: rec.mb_name, dis: rec.mb_disambiguation || '' });
                continue;
            }
            const mbid = (r.mbUrl || '').split('/').pop().replace(/[^a-f0-9-]/g, '').substring(0, 36);
            if (!mbid) continue;
            const et = r.entityType || 'artist';
            const data = await mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/${et}/${mbid}?fmt=json`);
            if (data?.name) {
                    _preloadedNames.set(rUrl, { name: data.name, dis: data.disambiguation || '' });
                    if (idbKey && db) try {
                        db.transaction(['mblinks'], 'readwrite').objectStore('mblinks').put({
                            discogs_id: idbKey, mb_links: [r.mbUrl],
                            mb_name: data.name, mb_disambiguation: data.disambiguation || '' });
                    } catch(e) {}
            }
            await new Promise(ok => setTimeout(ok, 200));
        } catch(e) {}
    }

    return new Promise(resolve => {
        // Per-row state: resource_url -> { mbUrl, mbName, mbDisambig, confirmed }
        let tableReady = false; // prevents saveCache during initial row population
        // saveCache: persists current rowState to localStorage immediately
        // Stores a minimal representation to avoid localStorage quota issues
        function saveCache() {
            if (!tableReady) return; // don't save during initial population
            if (!cacheKey) return;
            try {
                const today2 = new Date().toISOString().slice(0, 10);
                const slim = allResults.map(r => {
                    const eKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
                    const s = rowState.get(eKey);
                    const mbUrl  = s?.mbUrl  || r.mbUrl  || null;
                    const mbName = s?.mbName || r.mbName || null;
                    return {
                        type:         mbUrl ? 'resolved' : 'attention',
                        entityType:   r.entityType   || 'artist',
                        displayName:  r.displayName  || r.entity?.name || '',
                        discogsHref:  r.discogsHref  || '',
                        rateLimited:  mbUrl ? false : (r.rateLimited || false),
                        nameMatches:  mbUrl ? [] : (r.nameMatches || []).slice(0, 5),
                        mbUrl,
                        mbName: mbName || r.mbName || null,
                        mbDisambig: s?.mbDisambig || r.mbDisambig || '',
                        entity: { resource_url: r.entity?.resource_url, name: r.entity?.name || '', _syntheticKey: r.entity?._syntheticKey || '' },
                    };
                });
                localStorage.setItem(cacheKey, JSON.stringify({ date: today2, results: slim }));
            } catch(e) {
                console.warn('Discogs importer: saveCache failed', e);
            }
        }
        // confirmed = true means the user is happy with this match (or it auto-matched cleanly)
        const rowState = new Map();

        const attentionCount = allResults.filter(r => r.type === 'attention').length;
        const mismatchCount  = allResults.filter(r => {
            if (r.type !== 'resolved') return false;
            const e = r.logEntry;
            return e && e.mbName && e.displayName && e.mbName.toLowerCase().trim() !== e.displayName.toLowerCase().trim();
        }).length;

        // ── Shared concurrency pool for Discogs-URL-link checks ─────────────
        // Uses the same burst+retry pattern as checkMissingArtists:
        // up to 5 concurrent requests, 200ms stagger between slots,
        // automatic exponential backoff on 429/503.
        const URL_CHECK_CONCURRENCY = 5;
        const urlCheckPending = []; // { fn, resolve, reject }
        let urlCheckRunning = 0;
        let urlCheckStarted = false;



        function queuedUrlCheck(fn) {
            return new Promise((resolve, reject) => {
                urlCheckPending.push({ fn, resolve, reject });
                // Restart a worker if none are running (handles late additions after initial drain)
                if (urlCheckRunning < URL_CHECK_CONCURRENCY) {
                    runUrlCheckWorker();
                }
            });
        }

        async function runUrlCheckWorker() {
            urlCheckRunning++;
            while (urlCheckPending.length > 0) {
                const { fn, resolve, reject } = urlCheckPending.shift();
                try { resolve(await fn()); } catch(e) { reject(e); }
                if (urlCheckPending.length > 0) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            urlCheckRunning--;
        }

        // ── Panel shell ────────────────────────────────────────────────────────
        const panel = document.createElement('div');
        panel.style.cssText = 'border:2px solid #c8a000;border-radius:0.5rem;background:#fffef5;padding:1rem 1.5rem;margin:0.5rem 0;';
        // Hide progress row while review table is shown
        { const _pb = document.getElementById('discogs-progress-bar'); if (_pb) _pb.style.display = 'none'; }
        // Hide progress row while review table is shown
        const _bar = document.querySelector('.discogs-bar');
        if (_bar) {
            _hideBar();
            const _r2 = _bar.querySelector('.discogs-bar-row2'); if (_r2) _r2.style.marginTop = '';
        }

        const heading = document.createElement('div');
        heading.style.cssText = `display:flex;align-items:center;gap:0.6rem;margin:0 0 0.5rem;padding:0.4rem 0.6rem;border-radius:0.3rem;` +
            (isFromCache ? 'background:#ddeeff;border:1px solid #88aacc;' : 'background:#f5e8a0;border:1px solid #d4b800;');
        const headingText = document.createElement('span');
        headingText.style.cssText = 'font-weight:bold;font-size:1rem;color:#' + (isFromCache ? '003366' : '5a4000') + ';flex:1;';
        headingText.textContent = `Review — ${allResults.length} entit${allResults.length === 1 ? "y" : "ies"}` +
            (isFromCache ? ' (cached)' : '');
        heading.appendChild(headingText);
        if (isFromCache) {
            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;padding:0.2rem 0.5rem;border:1px solid #88aacc;border-radius:3px;background:#fff;color:#003366;';
            refreshBtn.title = 'Clear cache and re-run pre-flight checks';
            refreshBtn.addEventListener('click', () => {
                if (cacheKey) try { localStorage.removeItem(cacheKey); } catch(e) {}
                (panelLi || panel).remove();
                if (onRefresh) {
                    onRefresh().then(freshResults => {
                        // Show new review table with fresh results (not from cache)
                        showReviewTable(freshResults, rolesMap, companiesRolesMap, {
                            isFromCache: false,
                            cacheKey,
                            onRefresh,
                        }).then(confirmedMap => resolve(confirmedMap));
                    });
                }
            });
            heading.appendChild(refreshBtn);
        }
        panel.appendChild(heading);

        const intro = document.createElement('p');
        intro.style.cssText = 'margin:0 0 0.75rem;font-size:0.85rem;color:#666;';
        intro.innerHTML =
            'Review all artist matches before importing. ' +
            '<span style="background:#ffe0e0;padding:0 0.3rem;border-radius:2px;">Red rows</span> need attention. ' +
            '<span style="background:#fff8e1;padding:0 0.3rem;border-radius:2px;">Yellow rows</span> have a name mismatch — verify. ' +
            'Green rows are confirmed. Use the search or create buttons to resolve outstanding issues.';
        panel.appendChild(intro);

        // ── Table ──────────────────────────────────────────────────────────────
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.85rem;';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        hr.style.background = '#f5e8a0';
        ['Discogs entity', 'MB match / search', 'Actions'].forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = 'text-align:left;padding:0.3rem 0.5rem;border:1px solid #d4b800;white-space:nowrap;';
            th.textContent = col;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        allResults.forEach(r => {
            // Unified fields set by both checkMissingArtists and checkMissingCompanies
            const entityType  = r.entityType || 'artist';
            const displayName = r.displayName || r.entity?.name || '';
            const discogsHref = r.discogsHref || '';
            const e           = r.logEntry || null;
            // Keep backward-compat alias
            const artist      = r.entity;

            // Initial state
            const isResolved  = r.type === 'resolved';
            const initMbUrl   = isResolved ? r.mbUrl : null;
            const _entityKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
            const _pl = _preloadedNames.get(_entityKey) || _preloadedNames.get(r.entity?.resource_url);
            const initMbName  = (e && e.mbName) ? e.mbName : (_pl?.name || (isResolved ? r.mbName : null) || null);
            const initMbDisam = (e && e.mbDisambig) ? e.mbDisambig : (_pl?.dis || r.mbDisambig || '');
            const nameMismatch = isResolved && initMbName &&
                initMbName.toLowerCase().trim() !== displayName.toLowerCase().trim();
            const needsAttention = r.type === 'attention';

            // Row background: orange = needs attention, yellow = mismatch, white = clean
            const rowBg = needsAttention ? '#ffe0e0' : (nameMismatch ? '#fff8e1' : '#fff');
            const borderColor = needsAttention ? '#cc6666' : '#d4d4d4';

            const tr = document.createElement('tr');
            tr.style.cssText = `vertical-align:top;background:${rowBg};`;

            // Initialise rowState
            rowState.set(_entityKey, {
                mbUrl: initMbUrl, mbName: initMbName, mbDisambig: initMbDisam,
                confirmed: isResolved && !needsAttention,
            });

            // ── Col 1: Discogs ─────────────────────────────────────────────────
            const tdDiscogs = document.createElement('td');
            tdDiscogs.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
            if (entityType !== 'artist') {
                const badge = document.createElement('span');
                badge.textContent = entityType;
                badge.style.cssText = 'font-size:0.7rem;background:#e0e0e0;border-radius:3px;padding:0 0.3rem;margin-right:0.3rem;color:#555;vertical-align:middle;';
                tdDiscogs.appendChild(badge);
            }
            const hasDiscogsUrl = !!(r.entity?.resource_url);
            const dlA = document.createElement(hasDiscogsUrl ? 'a' : 'span');
            dlA.href = discogsHref; dlA.target = '_blank'; dlA.rel = 'noopener noreferrer nofollow';
            dlA.textContent = displayName;
            tdDiscogs.appendChild(dlA);
            if (!hasDiscogsUrl) {
                const noUrl = document.createElement('span');
                noUrl.textContent = ' \u26a0\ufe0f'; noUrl.title = 'No Discogs artist page — manual search needed';
                noUrl.style.cssText = 'cursor:help;color:#c80;';
                tdDiscogs.appendChild(noUrl);
            }
            if (nameMismatch) {
                const w = document.createElement('span');
                w.textContent = ' \u26a0\ufe0f'; w.title = 'Name differs from MB match';
                w.style.cursor = 'help';
                tdDiscogs.appendChild(w);
            }
            tr.appendChild(tdDiscogs);

            // Roles line below entity name
            const rolesList = r._roles || [];
            if (rolesList.length > 0) {
                const labels = [...new Map(rolesList.map(({displayLabel, linkType, trackPos}) => {
                    const key = displayLabel || linkType;
                    return [key + (trackPos ? '['+trackPos+']' : ''), key + (trackPos ? ' ['+trackPos+']' : '')];
                })).values()];
                const rolesLine = document.createElement('div');
                rolesLine.style.cssText = 'font-size:0.75rem;color:#888;margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;';
                rolesLine.title = labels.join(', ');
                rolesLine.textContent = labels.join(', ');
                tdDiscogs.appendChild(rolesLine);
            }

            // ── Col 2: MB artist / search ──────────────────────────────────────
            const tdMb = document.createElement('td');
            tdMb.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};min-width:240px;`;

            const candidateList = document.createElement('div');
            candidateList.style.cssText = 'display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.3rem;';

            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'display:flex;gap:0.3rem;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.value = displayName;
            searchInput.style.cssText = 'flex:1;padding:0.15rem 0.35rem;font-size:0.82rem;border:1px solid #bbb;border-radius:3px;';
            const searchBtn = document.createElement('button');
            searchBtn.textContent = '\uD83D\uDD0D';
            searchBtn.title = 'Search MusicBrainz';
            searchBtn.style.cssText = 'padding:0.15rem 0.35rem;cursor:pointer;';
            searchRow.appendChild(searchInput);
            searchRow.appendChild(searchBtn);

            tdMb.appendChild(candidateList);
            tdMb.appendChild(searchRow);
            tr.appendChild(tdMb);

            // ── Col 3: Actions ─────────────────────────────────────────────────
            const tdAction = document.createElement('td');
            tdAction.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
            tr.appendChild(tdAction);
            tbody.appendChild(tr);

            // ── Helpers ────────────────────────────────────────────────────────
            function setRowResolved(a) {
                // a = { id, name, disambiguation }
                const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
                rowState.set(_entityKey, { mbUrl, mbName: a.name, mbDisambig: a.disambiguation || '', confirmed: true });
                // Persist to IDB immediately so selection survives even without clicking Start import
                const _idbKey = r.entity?.resource_url ? getDiscogsLinkKey(r.entity.resource_url) : null;
                if (_idbKey && db) {
                    try {
                        const _tx = db.transaction(['mblinks'], 'readwrite');
                        _tx.objectStore('mblinks').put({ discogs_id: _idbKey, mb_links: [mbUrl], mb_name: a.name, mb_disambiguation: a.disambiguation || '' });
                    } catch(e) {}
                }

                tr.style.background = '#f0fff0';
                searchInput.disabled = true;
                searchBtn.disabled = true;

                candidateList.innerHTML = '';
                const selRow = document.createElement('div');
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + mbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + a.name + (a.disambiguation ? ` (${a.disambiguation})` : '');
                selA.style.fontWeight = 'bold';
                // Allow un-confirming
                const undoBtn = document.createElement('button');
                undoBtn.textContent = '\u2715';
                undoBtn.title = 'Clear selection';
                undoBtn.style.cssText = 'font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;';
                undoBtn.addEventListener('click', () => setRowUnresolved());
                selRow.appendChild(selA);
                selRow.appendChild(undoBtn);
                candidateList.appendChild(selRow);

                // Actions: Add Discogs link + Create fallback
                renderActions(a);
                updateImportBtn();
                saveCache();
            }

            function setRowUnresolved() {
                rowState.set(_entityKey, { mbUrl: null, mbName: null, mbDisambig: '', confirmed: false });
                tr.style.background = '#ffe0e0';
                searchInput.disabled = false;
                searchBtn.disabled = false;
                candidateList.innerHTML = '';
                const none = document.createElement('div');
                none.style.cssText = 'font-size:0.82rem;color:#888;';
                none.textContent = 'No selection \u2014 search or create';
                candidateList.appendChild(none);
                renderActions(null);
                updateImportBtn();
                saveCache();
            }

            function renderActions(selected) {
                tdAction.innerHTML = '';
                if (selected) {
                    // Check if artist already has this Discogs URL linked — show button only if missing
                    const linkSlot = document.createElement('span');
                    linkSlot.style.cssText = 'display:block;margin-bottom:0.25rem;font-size:0.8rem;';
                    linkSlot.textContent = 'Checking Discogs link…';
                    tdAction.appendChild(linkSlot);

                    // Query whether this specific Discogs URL is already linked in MB.
                    // Cache result in localStorage for today to avoid repeated checks.
                    // Use session Map as primary cache; fall back to localStorage for cross-session
                    const urlCheckCacheKey = `${selected.id}|${discogsHref}`;
                    const urlCheckLsKey = `discogs-urlcheck-${selected.id}-${discogsHref.replace(/[^a-z0-9]/gi,'-').substring(0,80)}`;
                    const urlCheckToday = new Date().toISOString().slice(0, 10);
                    const urlCheckExpiry = new Date(); urlCheckExpiry.setDate(urlCheckExpiry.getDate() - 7);
                    const urlCheckExpiryStr = urlCheckExpiry.toISOString().slice(0, 10);
                    let urlCheckCached = _urlCheckSessionCache.get(urlCheckCacheKey) ?? null;
                    if (urlCheckCached === null) {
                        try { const s = JSON.parse(localStorage.getItem(urlCheckLsKey)||'null'); if (s?.date >= urlCheckExpiryStr) urlCheckCached = s.result; } catch(e) {}
                        if (urlCheckCached !== null) _urlCheckSessionCache.set(urlCheckCacheKey, urlCheckCached);
                    }

                    function applyUrlCheckResult(result) {
                        if (result === 'linked') {
                            linkSlot.textContent = '\u2713 Discogs URL already linked';
                            linkSlot.style.color = '#5a5';
                        } else if (result === 'other') {
                            linkSlot.innerHTML = `\u26a0\ufe0f Linked to a different MB ${entityType}`;
                            linkSlot.style.color = '#c80';
                        } else {
                            linkSlot.textContent = '';
                            const addLinkBtn = document.createElement('button');
                            addLinkBtn.textContent = 'Add Discogs link \u2197';
                            addLinkBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;display:block;white-space:nowrap;';
                            addLinkBtn.addEventListener('click', () => {
                                const ltId = entityType === 'label' ? '217' : entityType === 'place' ? '705' : '180';
                                const p = new URLSearchParams({ [`edit-${entityType}.url.0.text`]: discogsHref, [`edit-${entityType}.url.0.link_type_id`]: ltId });
                                const mbid = selected.id.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                                window.open(`https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`, '_blank', 'noopener,noreferrer');
                            });
                            linkSlot.appendChild(addLinkBtn);
                        }
                    }

                    if (!discogsHref) {
                        // No Discogs URL — skip URL check entirely
                        linkSlot.textContent = '⚠ No Discogs page';
                        linkSlot.style.color = '#c80';
                    } else if (urlCheckCached !== null) {
                        applyUrlCheckResult(urlCheckCached);
                    } else {
                        queuedUrlCheck(() =>
                            fetchWithRetry(`//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`)
                                .then(json => {
                                    const linkedIds = (json.relations || []).filter(r => r[entityType]).map(r => r[entityType].id);
                                    const result = linkedIds.includes(selected.id) ? 'linked' : linkedIds.length > 0 ? 'other' : 'none';
                                    _urlCheckSessionCache.set(urlCheckCacheKey, result);
                                    try { localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result })); } catch(e) {}
                                    applyUrlCheckResult(result);
                                })
                                .catch(() => applyUrlCheckResult('none'))
                        );
                    }
                }
                const createBtn = document.createElement('button');
                createBtn.textContent = 'Create in MB ↗';
                createBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;display:block;white-space:nowrap;';
                createBtn.addEventListener('click', () => {
                    if (entityType === 'artist') {
                        const createParams = {
                            'edit-artist.name': displayName,
                            'edit-artist.sort_name': guessSortName(displayName),
                            'edit-artist.type_id': '1',
                        };
                        if (discogsHref) {
                            createParams['edit-artist.url.0.text'] = discogsHref;
                            createParams['edit-artist.url.0.link_type_id'] = '180';
                        }
                        const p = new URLSearchParams(createParams);
                        const newTab = window.open(`https://musicbrainz.org/artist/create?${p}`, '_blank');
                        if (newTab) {
                            const trySet = () => {
                                try { newTab.sessionStorage.setItem('discogs-importer-pending-artist', r.entity.resource_url); }
                                catch(e) { setTimeout(trySet, 50); }
                            };
                            trySet();
                        }
                        const onCreated = (evt) => {
                            if (evt.data?.type !== 'artist-created') return;
                            if (evt.data.resourceUrl !== r.entity.resource_url) return;
                            DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                            setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
                        };
                        DISCOGS_CHANNEL.addEventListener('message', onCreated);
                    } else {
                        const ltId = entityType === 'label' ? '217' : '705';
                        const p = new URLSearchParams({
                            [`edit-${entityType}.name`]: displayName,
                            [`edit-${entityType}.url.0.text`]: discogsHref,
                            [`edit-${entityType}.url.0.link_type_id`]: ltId,
                        });
                        const newTab = window.open(`https://musicbrainz.org/${entityType}/create?${p}`, '_blank');
                        if (newTab) {
                            const trySet = () => {
                                try { newTab.sessionStorage.setItem('discogs-importer-pending-artist', r.entity.resource_url); }
                                catch(e) { setTimeout(trySet, 50); }
                            };
                            trySet();
                        }
                        const onCreated = (evt) => {
                            if (evt.data?.type !== 'artist-created') return;
                            if (evt.data.resourceUrl !== r.entity.resource_url) return;
                            DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                            setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
                        };
                        DISCOGS_CHANNEL.addEventListener('message', onCreated);
                    }
                });
                tdAction.appendChild(createBtn);
            }

            function makeCandidateRow(a) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0.35rem;border:1px solid #ddd;border-radius:3px;background:#fff;font-size:0.82rem;';
                const info = document.createElement('span');
                info.style.flex = '1';
                const nameA = document.createElement('a');
                nameA.href = `https://musicbrainz.org/${entityType}/${a.id}`;
                nameA.target = '_blank'; nameA.rel = 'noopener noreferrer nofollow';
                nameA.style.fontWeight = 'bold';
                nameA.textContent = a.name;
                info.appendChild(nameA);
                if (a.disambiguation) {
                    const d = document.createElement('span');
                    d.style.cssText = 'color:#777;margin-left:0.25rem;';
                    d.textContent = `(${a.disambiguation})`;
                    info.appendChild(d);
                }
                row.appendChild(info);
                const selBtn = document.createElement('button');
                selBtn.textContent = 'Select';
                selBtn.style.cssText = 'font-size:0.78rem;cursor:pointer;padding:0.1rem 0.3rem;white-space:nowrap;';
                selBtn.addEventListener('click', () => setRowResolved(a));
                row.appendChild(selBtn);
                return row;
            }

            // Extract MBID from a raw UUID or MB URL
            function extractMbid(q) {
                const m = q.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                return m ? m[0] : null;
            }

            function doSearch(q) {
                if (!q) return;
                // If input looks like an MBID or MB URL, fetch directly
                const mbid = extractMbid(q);
                if (mbid) {
                    candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Looking up MBID…</div>';
                    mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`)
                        .then(json => {
                            if (!json) return;
                            candidateList.innerHTML = '';
                            if (json.id) {
                                candidateList.appendChild(makeCandidateRow({
                                    id: json.id,
                                    name: json.name,
                                    disambiguation: json.disambiguation || '',
                                }));
                            } else {
                                candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Not found</div>';
                            }
                        })
                        .catch(() => {
                            candidateList.innerHTML = `<div style="font-size:0.82rem;color:#c00;">MBID not found or wrong entity type</div>`;
                        });
                    return;
                }
                mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`)
                    .then(json => {
                        if (!json) return;
                        candidateList.innerHTML = '';
                        const resultKey = entityType === 'label' ? 'labels' : entityType === 'place' ? 'places' : 'artists';
                        if (!json[resultKey] || json[resultKey].length === 0) {
                            const none = document.createElement('div');
                            none.style.cssText = 'font-size:0.82rem;color:#888;';
                            none.textContent = 'No results';
                            candidateList.appendChild(none);
                        } else {
                            json[resultKey].forEach(a => candidateList.appendChild(makeCandidateRow(a)));
                        }
                    }).catch(() => {});
            }

            let searchTimer;
            searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(searchInput.value.trim()), 300); });
            searchInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doSearch(searchInput.value.trim()); } });
            searchBtn.addEventListener('click', () => doSearch(searchInput.value.trim()));

            // ── Initial population ─────────────────────────────────────────────
            if (isResolved && initMbUrl) {
                // Pre-fill with the auto-matched result.
                // Always reconstruct the MB URL using the current entityType — the cached
                // mbUrl may have been stored as /artist/ for what is now a /label/ or /place/.
                const mbid = initMbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                const correctedMbUrl = `//musicbrainz.org/${entityType}/${mbid}`;
                // If name fetch was rate-limited, use MBID as display and mark unconfirmed
                const displayName2 = initMbName || mbid;
                if (!initMbName) {
                    // Name was null in cache — keep yellow, IDB pre-load handled before rendering
                    rowState.set(_entityKey, { mbUrl: initMbUrl, mbName: null, mbDisambig: '', confirmed: true });
                    tr.style.background = '#fff8e1';
                }
                const fakeA = { id: mbid, name: displayName2, disambiguation: initMbDisam };
                candidateList.innerHTML = '';
                const selRow = document.createElement('div');
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + correctedMbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + displayName2 + (initMbDisam ? ` (${initMbDisam})` : '') + (!initMbName ? ' ⚠ name unknown' : '');
                selA.style.fontWeight = 'bold';
                const undoBtn = document.createElement('button');
                undoBtn.textContent = '\u2715';
                undoBtn.title = 'Clear selection';
                undoBtn.style.cssText = 'font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;';
                undoBtn.addEventListener('click', () => setRowUnresolved());
                selRow.appendChild(selA);
                selRow.appendChild(undoBtn);
                candidateList.appendChild(selRow);
                renderActions(fakeA);
            } else if (r.nameMatches && r.nameMatches.length > 0) {
                r.nameMatches.forEach(a => candidateList.appendChild(makeCandidateRow(a)));
                renderActions(null);
            } else {
                const none = document.createElement('div');
                none.style.cssText = 'font-size:0.82rem;color:#888;';
                none.textContent = needsAttention ? 'No suggestions \u2014 search or create' : '';
                if (needsAttention) candidateList.appendChild(none);
                renderActions(null);
            }
        });

        table.appendChild(tbody);
        panel.appendChild(table);

        // ── Import button ──────────────────────────────────────────────────────
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.75rem;align-items:center;margin-top:0.75rem;flex-wrap:wrap;';

        const importBtn = document.createElement('button');
        importBtn.style.cssText = 'border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;';

        const issueNote = document.createElement('span');
        issueNote.style.cssText = 'font-size:0.85rem;color:#7a5c00;';

        function updateImportBtn() {
            const unresolved = [...rowState.values()].filter(s => !s.confirmed).length;
            const mismatch   = [...rowState.values()].filter(s => s.confirmed && s.mbName &&
                s.mbName.toLowerCase().trim() !== s.mbUrl).length; // rough check
            if (unresolved === 0) {
                importBtn.textContent = 'Start import \u2192';
                importBtn.style.background = '#2ecc40';
                importBtn.style.color = '#fff';
                issueNote.textContent = '';
            } else {
                importBtn.textContent = `Start import anyway \u2192`;
                importBtn.style.background = '#e0a800';
                importBtn.style.color = '#fff';
                issueNote.textContent = `\u26a0 ${unresolved} artist(s) unresolved \u2014 they will be skipped`;
            }
        }
        updateImportBtn();

        importBtn.addEventListener('click', () => {
            const confirmedMap = new Map();
            rowState.forEach((s, key) => {
                if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
            });

            saveCache();

            // ── Log summary table ──────────────────────────────────────
            const tbl = document.createElement('table');
            tbl.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;';
            const thRow = document.createElement('tr');
            thRow.style.background = '#f5f5f5';
            ['Discogs entity', 'Roles / Tracks', 'MB match', 'MBID'].forEach(h => {
                const th = document.createElement('th');
                th.style.cssText = 'text-align:left;padding:0.2rem 0.4rem;border:1px solid #ddd;white-space:nowrap;';
                th.textContent = h;
                thRow.appendChild(th);
            });
            tbl.appendChild(thRow);
            allResults.forEach(r => {
                const _rKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
                const state = rowState.get(_rKey) || {};
                const tr2 = document.createElement('tr');
                const url = r.entity?.resource_url || r.entity?._syntheticKey || '';
                const rolesList2 = url ? (rolesMap.get(url) || companiesRolesMap.get(url) || []) : [];
                const grouped2 = new Map();
                rolesList2.forEach(({ displayLabel, linkType, trackPos }) => {
                    const key = displayLabel || linkType;
                    if (!grouped2.has(key)) grouped2.set(key, new Set());
                    if (trackPos) grouped2.get(key).add(trackPos);
                });
                const rolesText = [...grouped2.entries()].map(([label, tr]) =>
                    label + (tr.size ? ' [' + [...tr].join(',') + ']' : '')).join('; ');

                const mbid = state.mbUrl ? state.mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi,'').substring(0,36) : '';
                const matchText = state.mbName || (state.mbUrl ? mbid : '');

                [r.displayName || r.entity?.name, rolesText, matchText, mbid].forEach((val, ci) => {
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #ddd;' +
                        (ci === 2 && !val ? 'color:#aaa;' : ci === 2 ? 'color:#060;' : '');
                    if (ci === 2 && mbid) {
                        const a = document.createElement('a');
                        a.href = 'https:' + state.mbUrl; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
                        a.textContent = val || mbid;
                        td.appendChild(a);
                    } else {
                        td.textContent = val || (ci === 1 ? '' : ci === 2 ? '—' : '');
                    }
                    tr2.appendChild(td);
                });
                tbl.appendChild(tr2);
            });
            const tblLi = document.createElement('li');
            tblLi.style.cssText = 'list-style:none;margin:0;padding:0;';
            tblLi.appendChild(tbl);
            logs.appendChild(tblLi);
            // ─────────────────────────────────────────────────────────

            // Add unresolved count line after the table
            const unresolvedCount = allResults.filter(r => { const _k = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`; return !rowState.get(_k)?.confirmed; }).length;
            if (unresolvedCount > 0) {
                const unresolvedLi = document.createElement('li');
                unresolvedLi.style.cssText = 'list-style:none;margin:0.2rem 0;font-size:0.82rem;color:#a06000;';
                unresolvedLi.textContent = `⚠ ${unresolvedCount} entity/entities unresolved — will be skipped`;
                logs.appendChild(unresolvedLi);
            }

            (panelLi || panel).remove();
            resolve(confirmedMap);
        });

        btnRow.appendChild(importBtn);
        btnRow.appendChild(issueNote);
        panel.appendChild(btnRow);

        const panelLi = document.createElement('li');
        panelLi.style.cssText = 'list-style:none;margin:0;padding:0;';
        panelLi.appendChild(panel);
        logs.appendChild(panelLi);
        logs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        _hideBar();
        tableReady = true; // allow saveCache now that all rows are populated
    });
}

function convertPotentialDJMixers(json) {
    let djmixers = json.extraartists?.filter(artist => artist.role === 'DJ Mix') || [];
    djmixers = djmixers
        .map(artist => {
            const tracks = getAllArtistTracks(json.tracklist, artist.tracks);
            const mediums = json.tracklist.reduce(
                (mediums, track, index) => {
                    if (track.type_ === 'heading') {
                        if (index > 0) {
                            mediums.push([]);
                        }
                    } else {
                        mediums[mediums.length - 1].push(track);
                    }
                    return mediums;
                },
                [[]]
            );
            // now see if we can empty all our mediums
            tracks.forEach(t => {
                for (let i = 0; i < mediums.length; i++) {
                    mediums[i] = mediums[i].filter(track => {
                        return t.position !== track.position;
                    });
                }
            });
            // if some mediums are empty then we know that the artist has tracks on that medium
            let mediumsDjAppearsOn = mediums.filter(medium => medium.length === 0);
            if (mediumsDjAppearsOn.length !== mediums.length) {
                // remove them from the extraartists list
                json.extraartists = json.extraartists?.filter(a => {
                    return a !== artist;
                }) || [];
                return Object.assign({}, ENTITY_TYPE_MAP['DJ Mix'], {
                    artist: artist,
                    attributes: [
                        () => {
                            for (let j = mediums.length - 1; j >= 0; j--) {
                                if (mediums[j].length === 0) {
                                    $(SELECTORS.MediumsInput).click();
                                    $($(SELECTORS.MediumsInputOptions).get(j)).click();
                                }
                            }
                        },
                    ],
                });
            } else if (mediumsDjAppearsOn.length === mediums.length) {
                // they're on all tracks so remove
                json.extraartists = json.extraartists?.filter(a => {
                    return a !== artist;
                }) || [];
                return Object.assign({}, ENTITY_TYPE_MAP['DJ Mix'], {
                    artist: artist,
                });
            }
            return null;
        })
        .filter(role => role !== null);
    return djmixers;
}

function getAllArtistTracks(tracklist, artistTracks) {
    // lets parse and get all tracks listed by the artist
    return artistTracks.split(',').reduce((trackArray, trackNumber) => {
        if (/ to /.test(trackNumber)) {
            // need to expand the range
            const parts = trackNumber.split(' to ');
            const startTrack = parts[0].trim().replace('.', '-');
            const lastTrack = parts[1].trim().replace('.', '-');
            let hasFoundStart = false,
                hasFoundEnd = false;
            tracklist.forEach(track => {
                const resolvedTrackPosition = track.position.replace('.', '-');
                if (!hasFoundStart && resolvedTrackPosition === startTrack) {
                    hasFoundStart = true;
                    trackArray.push(track);
                } else if (hasFoundStart && !hasFoundEnd) {
                    if (resolvedTrackPosition === lastTrack) {
                        hasFoundEnd = true;
                        trackArray.push(track);
                    } else if (track.position === '') {
                        hasFoundEnd = true;
                    } else {
                        trackArray.push(track);
                    }
                }
            });
        } else {
            const track = tracklist.find(track => {
                return track.position === trackNumber.trim();
            });
            if (track) {
                trackArray.push(track);
            }
        }
        return trackArray;
    }, []);
}

function convertDiscogsArtistsToRolesRelationships(artists) {
    return artists?.reduce((rolesArr, artist) => {
        const roles = getArtistRoles(artist);
        if (Array.isArray(roles) && roles.length > 0) {
            return rolesArr.concat(roles);
        }
        return rolesArr;
    }, []) || [];
}

// In-memory session cache for Discogs release JSON (avoids localStorage quota issues)
const _releaseDataCache = new Map();

function getDiscogsReleaseData(url) {
    // Check session memory first
    if (_releaseDataCache.has(url)) return Promise.resolve(_releaseDataCache.get(url));

    return fetch(
        `${url.replace(
            'https://www.discogs.com/release/',
            'https://api.discogs.com/releases/'
        )}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`
    )
        .then(body => body.json())
        .then(json => {
            _releaseDataCache.set(url, json); // session cache only
            return json;
        });
}

/**
 * Build the edit note / summary text used in two places:
 *  1. re.dispatch({ type: 'update-edit-note' }) at import start
 *  2. selectValue(EditNote) in updateSummary() after import
 */
function buildEditNote(discogsUrl, opts, extraLines) {
    const s = GM_info.script;
    const mbUrl = location.href.replace(/\/edit-relationships$/, '');
    const lines = [
        s.name + ' v' + s.version + ' by ' + s.author + ' - ' + s.homepageURL,
        '',
        'Release URL: ' + mbUrl,
        'Discogs URL: ' + discogsUrl,
    ];
    if (opts) lines.push('Options: ' + opts);
    if (extraLines) lines.push(...(Array.isArray(extraLines) ? extraLines : [extraLines]));
    return lines.join('\n');
}

function addRelationshipsForCompanies(companies) {
    return Promise.all(
        companies.map(company => {
            const details = ENTITY_TYPE_MAP[company.entity_type_name];
            if (details) {
                return getMbId(company, details.entityType)
                    .then(mbid => {
                        addReleaseRelationship(details.entityType, details.linkType, mbid, []);
                    })
                    .catch(error => {
                        addLogLine(
                            `Failed to add relationship for <a target="_blank" rel="noopener noreferrer nofollow" href="${company.resource_url}">${company.name}</a> - ${details.entityType} - ${details.linkType}<br />${error}`
                        );
                        console.warn(error);
                        return Promise.resolve();
                    });
            }
            return Promise.resolve();
        })
    );
}

function addRelationshipsForArtists(artistRoles) {
    return Promise.all(
        artistRoles
            .filter(role => !WORK_ONLY_ARTIST_RELS.includes(role.linkType))
            .map(role => {
            return getMbId(role.artist, 'artist')
                .then(mbid => {
                    return addReleaseRelationship(
                        role.entityType,
                        role.linkType,
                        mbid,
                        role.attributes || [],
                        // use anv first if set since that's the listing on the release
                        // else use the artist name incase it's different
                        role.artist.anv.trim() || role.artist.name
                    );
                })
                .catch(error => {
                    // Only log genuine lookup failures, not "already exists" (handled silently in addRelationship)
                    const msg = String(error);
                    if (!msg.includes('already exists') && !msg.includes('was not found in MB')) {
                        addLogLine(`<span style="color:red">ERR Failed to add relationship for ${role.artist.name} — ${role.linkType}: ${msg}</span>`);
                    } else if (msg.includes('was not found in MB')) {
                        addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} — not found in MB (${role.linkType})</span>`);
                    }
                    console.warn(error);
                    return Promise.resolve();
                });
        })
    );
}

function getTrackRowBasedOnTrack(track) {
    if (/^[0-9]*$/.test(track.position)) {
        // simple number
        const trackNumber = parseInt(track.position, 10);
        return Array.from(document.querySelectorAll(`#tracklist .track`)).find(el => {
            return el.firstElementChild.textContent.trim() === `${trackNumber}`;
        });
    } else if (/^[0-9]*[-.][0-9]*$/.test(track.position)) {
        // multi track release.
        const split = track.position.split(track.position.indexOf('-') > -1 ? '-' : '.');
        const mediumNumber = parseInt(split[0], 10);
        const trackNumber = parseInt(split[1], 10);
        let currentMediumNumber = 0;
        return Array.from(document.querySelectorAll(`#tracklist tr`)).find(el => {
            if (el.classList.contains('subh')) {
                currentMediumNumber++;
            }
            if (mediumNumber === currentMediumNumber) {
                return el.firstElementChild.textContent.trim() === `${trackNumber}`;
            }
        });
    } else {
        // assume alphabetical, e.g. A1, A2, or just A, B
        return Array.from(document.querySelectorAll(`#tracklist .track`)).find(el => {
            return el.firstElementChild.textContent.trim() === track.position;
        });
    }
}

function addRelationshipsForTracklist(tracklistRels) {
    return Promise.all(
        tracklistRels.map(role => {
            return getMbId(role.artist, 'artist')
                .then(mbid => {
                    let addRelButton;
                    const trackRowEl = getTrackRowBasedOnTrack(role.track);
                    if (!trackRowEl) {
                        addLogLine(
                            `<span style="color: orange">WARN Couldn't find a matching track for ${role.track.position} - ${role.track.title}: ${role.artist.name} - ${role.entityType} - ${role.linkType}</span>`
                        );
                        return Promise.resolve();
                    }
                    if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) {
                        addRelButton = $(trackRowEl.querySelector('.works')).find('button.add-relationship').get(0);
                        if (!addRelButton) {
                            addLogLine(
                                `<span style="color: orange">WARN You need to create a Work for track ${role.track.position} - ${role.track.title}: ${role.artist.name} - ${role.entityType} - ${role.linkType}</span>`
                            );
                            return Promise.resolve();
                        }
                    } else {
                        addRelButton = $(trackRowEl.querySelector(`.recording`)).find('button.add-relationship').get(0);
                    }
                    return addRelationship(
                        addRelButton,
                        role.entityType,
                        role.linkType,
                        mbid,
                        role.attributes || [],
                        // use anv first if set since that's the listing on the release
                        // else use the artist name incase it's different
                        role.artist.anv.trim() || role.artist.name
                    );
                })
                .catch(error => {
                    const msg = String(error);
                    if (!msg.includes('already exists') && !msg.includes('was not found in MB')) {
                        addLogLine(`<span style="color:red">ERR Failed to add relationship to track ${role.track.position} — ${role.track.title}: ${role.artist.name} — ${role.linkType}: ${msg}</span>`);
                    } else if (msg.includes('was not found in MB')) {
                        addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} on track ${role.track.position} — not found in MB (${role.linkType})</span>`);
                    }
                    console.warn(error);
                    return Promise.resolve();
                });
        })
    );
}

function getArtistRoles(artist) {
    const roleStr = artist.role;
    const rawRoles = roleStr.split(',');
    if (/\([0-9]+\)/.test(artist.anv)) {
        artist.anv = artist.anv.replace(/\([0-9]+\)/, '').trim();
    }
    if (/\([0-9]+\)/.test(artist.name)) {
        artist.name = artist.name.replace(/\([0-9]+\)/, '').trim();
    }
    return rawRoles
        .map(role => {
            let additionalAttributes = [];
            let rolePart = role.trim().split('[');
            const actualRole = rolePart[0].trim();
            if (/Recording Engineer/.test(rolePart[1]) && actualRole === 'Engineer') {
                return Object.assign({}, ENTITY_TYPE_MAP['Recording Engineer'], {
                    artist: artist,
                });
            }
            if (/Mastering Engineer/.test(rolePart[1]) && actualRole === 'Engineer') {
                return Object.assign({}, ENTITY_TYPE_MAP['Mastered By'], {
                    artist: artist,
                });
            }
            if (/Cover Design/.test(rolePart[1]) && actualRole === 'Artwork') {
                return Object.assign({}, ENTITY_TYPE_MAP['Design'], {
                    artist: artist,
                });
            }
            if (/Design/.test(rolePart[1]) && actualRole === 'Cover') {
                return Object.assign({}, ENTITY_TYPE_MAP['Design'], {
                    artist: artist,
                });
            }
            if (/Art/.test(rolePart[1]) && actualRole === 'Cover') {
                return Object.assign({}, ENTITY_TYPE_MAP['Artwork'], {
                    artist: artist,
                });
            }
            if (/Additional/.test(rolePart[1])) {
                additionalAttributes.push('additional');
            }
            if (/Assistant/.test(rolePart[1])) {
                additionalAttributes.push('assistant');
            }
            if (/Co /.test(rolePart[1])) {
                additionalAttributes.push('co');
            }
            if (/Executive/.test(rolePart[1])) {
                additionalAttributes.push('executive');
            }
            if (/Associate/.test(rolePart[1])) {
                additionalAttributes.push('associate');
            }
            if (/Guest/.test(rolePart[1])) {
                additionalAttributes.push('guest');
            }
            if (/Solo/.test(rolePart[1])) {
                additionalAttributes.push('solo');
            }
            const mapping = ENTITY_TYPE_MAP[actualRole];
            if (mapping && mapping.linkType == 'misc') {
                // Use sub-role text if present (e.g. '[Management]'), otherwise the role name itself
                const taskValue = rolePart[1] ? rolePart[1].replace(']', '').trim().toLowerCase() : actualRole.trim().toLowerCase();
                additionalAttributes.push({ _type: 'task', value: taskValue });
            }
            if (mapping && mapping.linkType == 'engineer' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'mix' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'photography' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'artwork' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (!mapping && INSTRUMENTS[actualRole] !== undefined) {
                // check if it's an instrument
                let instrumentName = actualRole;
                if (INSTRUMENTS[actualRole]) {
                    instrumentName = INSTRUMENTS[actualRole];
                }
                let role = ENTITY_TYPE_MAP.Instruments;
                if ('Drum Programming' === actualRole) {
                    role = ENTITY_TYPE_MAP['Programmed By'];
                    instrumentName = INSTRUMENTS['Drum Machine'];
                }
                return Object.assign({}, role, {
                    artist: artist,
                    attributes: instrumentName ? [{ _type: 'instrument', value: instrumentName.toLowerCase() }] : [],
                });
            }
            if (!mapping) {
                return null;
            }
            if (Array.isArray(mapping.attributes)) {
                additionalAttributes = additionalAttributes.concat(mapping.attributes);
            }
            return Object.assign({}, mapping, {
                artist: artist,
                attributes: additionalAttributes,
            });
        })
        .filter(resolvedRole => {
            return !!resolvedRole;
        });
}

function addReleaseRelationship(entityType, linkType, mbidUrl, extraAttributes, creditedAsName) {
    addRelationship(SELECTORS.AddReleaseRelationshipButton, entityType, linkType, mbidUrl, extraAttributes, creditedAsName);
}

function updateSummary() {
    const script_name = GM_info.script.name;
    const script_version = GM_info.script.version;
    const trackRelationshipUpdateCount = document.querySelectorAll('#tracklist .rel-add').length + document.querySelectorAll('#tracklist .rel-edit').length;
    const releaseRelationshipUpdateCount = document.querySelectorAll('#release-rels .rel-add').length;
    summary.innerHTML = `<p>Summary</p><p>Added ${releaseRelationshipUpdateCount} release relationships<br/>Added/Edited ${trackRelationshipUpdateCount} track relationships</p>`;
    selectValue($(SELECTORS.EditNote).get(0), buildEditNote(
        discogsUrl, null,
        `Added/changed: ${releaseRelationshipUpdateCount} release, ${trackRelationshipUpdateCount} track relationship(s)`
    ));
}

function addRelationship(targetQuerySelector, entityType, linkType, mbidUrl, extraAttributes, creditedAsName) {
    const uiWork = () => {
        let addRelButton;
        if (typeof targetQuerySelector == 'string') {
            addRelButton = document.querySelector(targetQuerySelector);
        } else if (targetQuerySelector) {
            addRelButton = targetQuerySelector;
        }
        if (!addRelButton) {
            addLogLine(`< span style = "color: red" > ERR Could find Add Relationship button for ${targetQuerySelector}</span > `);
            return doNext(() => { });
        }
        addRelButton.scrollIntoViewIfNeeded ? addRelButton.scrollIntoViewIfNeeded() : addRelButton.scrollIntoView();
        addRelButton.click();
        return doNext(() => {
            // choose the entity, e.g. artist, label, place
            const input = $(SELECTORS.AddRelationshipsDialogEntityType).get(0);
            if (input) {
                selectValue(input, entityType);
            } else {
                throw new Error(`Input not found: ${SELECTORS.AddRelationshipsDialogEntityType}. Is modal open?`);
            }
        })
            .then(() => {
                return doNext(() => {
                    return setValueOnAutocomplete(SELECTORS.AddRelationshipsDialogRelationshipType, linkType);
                });
            })
            .then(() => {
                return doNext(function () {
                    // now set the mbid url to choose the entity
                    return setValueOnAutocomplete(SELECTORS.AddRelationshipsDialogRelationshipTarget, mbidUrl);
                });
            })
            .then(() => {
                if (!creditedAsName) {
                    return Promise.resolve();
                }
                // process of "credited as" names if different
                else
                    return doNext(() => {
                        // let's ignore case here because Discogs doesn't respect case
                        if ($(SELECTORS.AddRelationshipsDialogRelationshipTarget).val().toLowerCase() !== creditedAsName.toLowerCase()) {
                            const input = $(SELECTORS.AddRelationshipsDialogEntityCredit).get(0);
                            setNativeValue(input, creditedAsName);
                        }
                    });
            })
            .then(() => {
                // any additional attributes processed here
                let previousPromise = Promise.resolve();
                extraAttributes.forEach(attribute => {
                    previousPromise = previousPromise.then(() => {
                        return doNext(() => {
                            return checkAdditionalAttribute(attribute);
                        });
                    });
                });
                return previousPromise;
            })
            .then(() => {
                return doNext(() => {
                    const doneButton = $(SELECTORS.AddRelationshipsDialogDoneButton)[0];
                    if (doneButton.disabled) {
                        // Check if it's disabled because the relationship already exists
                        // (shown as "This relationship already exists." in the dialog preview/error area)
                        const dialogText = document.querySelector('#add-relationship-dialog')?.innerText || '';
                        const alreadyExists = dialogText.includes('This relationship already exists');
                        if (!alreadyExists) {
                            // Done is disabled for some other reason — genuinely failed
                            addLogLine(
                                `<span style="color:red">ERR Failed to add relationship ${entityType}: <a href="${mbidUrl}" target="_blank" rel="noopener noreferrer nofollow">${creditedAsName || mbidUrl}</a> — ${linkType} (Done button disabled)</span>`
                            );
                        }
                        // If alreadyExists: silently skip, relationship is already there
                        makeClickEvent($(SELECTORS.AddRelationshipsDialogCancelButton)[0]);
                    } else {
                        makeClickEvent(doneButton);
                    }
                });
            })
            .then(() => {
                return doNext(() => {
                    updateSummary();
                });
            })
            .catch(err => {
                return doNext(() => {
                    // cancel if necessary
                    try {
                        makeClickEvent($(SELECTORS.AddRelationshipsDialogCancelButton)[0]);
                    } catch (err) {
                        // ignore error
                    }

                    updateSummary();
                    throw err;
                });
            });
    };
    if (!lastUiItem) {
        lastUiItem = uiWork();
    } else {
        lastUiItem = lastUiItem.then(uiWork);
    }
    return lastUiItem;
}

function getElementByLabel(selector, label) {
    return Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (el) {
        return el.textContent.trim() === label;
    })[0];
}

function checkAdditionalAttribute(additionalAttribute) {
    if (typeof additionalAttribute === 'function') {
        return additionalAttribute();
    } else {
        const additionalAttrLabel = getElementByLabel('.attribute-container label', additionalAttribute);
        if (additionalAttrLabel) {
            additionalAttrLabel.firstElementChild.click();
        }
    }
}

/////////////////////////////////////////////////////


function getMbId(discogsEntity, entityType) {
    const key = getDiscogsLinkKey(discogsEntity.resource_url);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['mblinks'], 'readonly');
        const objectStore = transaction.objectStore('mblinks');
        const request = objectStore.get(key);
        request.onerror = function () {
            scheduleRequest(discogsEntity, entityType)
                .then(result => {
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        };
        request.onsuccess = function () {
            // Do something with the request.result!
            if (request?.result?.mb_links?.length > 0) {
                resolve(request.result.mb_links[0]);
            } else {
                scheduleRequest(discogsEntity, entityType)
                    .then(result => {
                        resolve(result);
                    })
                    .catch(err => {
                        reject(err);
                    });
            }
        };
    });
}

function scheduleRequest(discogsEntity, entityType) {
    const key = getDiscogsLinkKey(discogsEntity.resource_url);
    return new Promise((resolve, reject) => {
        let query = `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=${entityType}-rels&fmt=json`;
        if (!link_infos[key]) {
            reject(`${key} for ${discogsEntity.name} not found in link_infos map`);
        } if (entityType === 'place') {
            query = `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=place-rels+label-rels&fmt=json`
        }
        let mbRequest = () => {
            fetch(query)
                .then(body => {
                    if (body.status === 503) {
                        throw 503;
                    }
                    return body.json();
                })
                .then(json => {
                    if (Array.isArray(json.relations) && json.relations.length > 0) {
                        const mb_links = [];
                        json.relations.forEach(relation => {
                            if (relation[entityType]) {
                                let mb_url = `//musicbrainz.org/${entityType}/${relation[entityType].id}`;
                                if (!mb_links.includes(mb_url)) {
                                    // prevent dupes
                                    mb_links.push(mb_url);
                                }
                            } else if (entityType === 'place' && relation['label']) {
                                let mb_url = `//musicbrainz.org/label/${relation['label'].id}`;
                                if (!mb_links.includes(mb_url)) {
                                    // prevent dupes
                                    mb_links.push(mb_url);
                                }

                            }
                        });
                        if (mb_links.length > 1) {
                            addLogLine(
                                `Warning ${mb_links.length} Musicbrainz entries for ${entityType} called ${discogsEntity.name
                                }: ${mb_links.map(link => {
                                    return `<a href="${link}" rel="noopener noreferrer nofolow" target="_blank">${link}</a>, `;
                                })}`
                            );
                        }
                        const transaction = db.transaction(['mblinks'], 'readwrite');
                        transaction.oncomplete = () => {
                            resolve(mb_links[0]);
                        };
                        transaction.onerror = err => {
                            console.warn(err);
                            // we'll ignore errors most of them are
                            // dupe key errors, but if we have a result we should use it.
                            resolve(mb_links[0]);
                        };
                        const objectStore = transaction.objectStore('mblinks');
                        objectStore.add({
                            discogs_id: key,
                            mb_links: mb_links,
                        });
                    } else {
                        reject(`${entityType} called ${discogsEntity.name} was not found in MB`);
                    }
                })
                .catch(err => {
                    if (err === 503) {
                        setTimeout(() => {
                            mbRequest();
                        }, 500 + Math.random() * 2000);
                        return;
                    }
                    console.error(err);
                    reject('Unknown error see developer console for details');
                });
        };
        if (!lastRequest) {
            lastRequest = mbRequest();
        } else {
            lastRequest = lastRequest.then(() => new Promise(r => setTimeout(r, 300))).then(mbRequest);
        }
    });
}

function setValueOnAutocomplete(selector, value) {
    const input = $(selector).get(0);
    setNativeValue(input, value);
    input.dispatchEvent(makeKeyDownEvent(13));
    return new Promise(resolve => {
        function isComplete() {
            if (!input.classList.contains('lookup-performed')) {
                setTimeout(isComplete, 50);
            } else {
                resolve();
            }
        }
        isComplete();
    });
}

// contains infos for each link key
const link_infos = {};

// Parse discogs url to extract info, returns a key and set link_infos for this key
// the key is in the form discogs_type/discogs_id
function getDiscogsLinkKey(url) {
    const re = /^https?:\/\/(?:www|api)\.discogs\.com\/(?:(?:(?!sell).+|sell.+)\/)?(master|release|artist|label)s?\/(\d+)(?:[^?#]*)(?:\?noanv=1|\?anv=[^=]+)?$/i;
    const m = re.exec(url);
    if (m !== null) {
        const key = `${m[1]}/${m[2]}`;
        if (!link_infos[key]) {
            link_infos[key] = {
                type: m[1],
                id: m[2],
                clean_url: `https://www.discogs.com/${m[1]}/${m[2]}`,
            };
        }
        return key;
    }
    return false;
}

const SELECTORS = {
    MediumsInput: '.multiselect-input',
    MediumsInputOptions: '.multiselect-input + .menu a',
    InstrumentsInput: '#add-relationship-dialog .multiselect.instrument input[aria-autocomplete]',
    VocalsTypeInput: '#add-relationship-dialog .multiselect.vocal input[aria-autocomplete]',
    AddRelationshipsDialogEntityType: '#add-relationship-dialog .entity-type',
    AddRelationshipsDialogRelationshipType: '#add-relationship-dialog input.relationship-type',
    AddRelationshipsDialogRelationshipTarget: '#add-relationship-dialog input.relationship-target',
    AddRelationshipsDialogEntityCredit: '#add-relationship-dialog input.entity-credit',
    AddRelationshipsDialogDoneButton: '#add-relationship-dialog .buttons button.positive',
    AddRelationshipsDialogError: '#add-relationship-dialog .error',
    AddRelationshipsDialogCancelButton: '#add-relationship-dialog .buttons button.negative',
    AddReleaseRelationshipButton: '#release-rels button.add-relationship',
    EditNote: '#edit-note-text',
    TaskInput: '#add-relationship-dialog .attribute-container.task input',
};

const ENTITY_TYPE_MAP = {
    // Places
    'Arranged At': {
        entityType: 'place',
        linkType: 'arranged at',
    },
    'Engineered At': {
        entityType: 'place',
        linkType: 'engineered at',
    },
    'Recorded At': {
        entityType: 'place',
        linkType: 'recorded at',
    },
    'Mixed At': {
        entityType: 'place',
        linkType: 'mixed at',
    },
    'Mastered At': {
        entityType: 'place',
        linkType: 'mastered at',
    },
    'Lacquer Cut At': {
        entityType: 'place',
        linkType: 'lacquer cut at',
    },
    'edited At': {
        entityType: 'place',
        linkType: 'edited at',
    },
    'Remixed At': {
        entityType: 'place',
        linkType: 'remixed at',
    },
    'Produced At': {
        entityType: 'place',
        linkType: 'produced at',
    },
    'Overdubbed At': null,
    'manufactured At': {
        entityType: 'place',
        linkType: 'manufactured at',
    },
    'Glass Mastered At': {
        entityType: 'place',
        linkType: 'glass mastered at',
    },
    'Pressed At': {
        entityType: 'place',
        linkType: 'pressed at',
    },
    'Designed At': null,
    'Filmed At': null,
    'Exclusive Retailer': null,
    // labels
    'Copyright (c)': {
        entityType: 'label',
        linkType: 'copyright',
    },
    'Phonographic Copyright (p)': {
        entityType: 'label',
        linkType: 'phonographic copyright',
    },
    'Copyright ©': {
        entityType: 'label',
        linkType: 'copyright',
    },
    'Phonographic Copyright ℗': {
        entityType: 'label',
        linkType: 'phonographic copyright',
    },
    'Licensed From': {
        entityType: 'label',
        linkType: 'licensor',
    },
    'Licensed To': {
        entityType: 'label',
        linkType: 'licensee',
    },
    'Licensed Through': null,
    'Distributed By': {
        entityType: 'label',
        linkType: 'distributed',
    },
    'Made By': {
        entityType: 'label',
        linkType: 'manufactured',
    },
    'Manufactured By': {
        entityType: 'label',
        linkType: 'manufactured',
    },
    'Glass Mastered By': {
        entityType: 'label',
        linkType: 'glass mastered',
    },
    'Pressed By': {
        entityType: 'label',
        linkType: 'pressed',
    },
    'Marketed By': {
        entityType: 'label',
        linkType: 'marketed',
    },
    'Printed By': {
        entityType: 'label',
        linkType: 'printed',
    },
    'Promoted By': {
        entityType: 'label',
        linkType: 'promoted',
    },
    'Published By': {
        entityType: 'label',
        linkType: 'published',
    },
    'Rights Society': {
        entityType: 'label',
        linkType: 'rights society',
    },
    'Arranged For': {
        entityType: 'label',
        linkType: 'arranged for',
    },
    'Manufactured For': {
        entityType: 'label',
        linkType: 'manufactured for',
    },
    'Mixed For': {
        entityType: 'label',
        linkType: 'mixed for',
    },
    'Produced For': {
        entityType: 'label',
        linkType: 'produced for',
    },
    'Miscellaneous Support': {
        entityType: 'label',
        linkType: 'misc',
    },
    'Exported By': null,
    // Artists
    Performer: {
        entityType: 'artist',
        linkType: 'performer',
    },
    Instruments: {
        entityType: 'artist',
        linkType: 'instrument',
    },
    Vocals: {
        entityType: 'artist',
        linkType: 'vocal',
    },
    'Backing Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'background vocals' }],
    },
    Choir: {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    Chorus: {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    'Choir Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    'Lead Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'lead vocals' }],
    },
    Orchestra: {
        entityType: 'artist',
        linkType: 'orchestra',
    },
    Conductor: {
        entityType: 'artist',
        linkType: 'conductor',
    },
    'Chorus Master': {
        entityType: 'artist',
        linkType: 'chorus master',
    },
    Concertmaster: {
        entityType: 'artist',
        linkType: 'concertmaster',
    },
    Concertmistress: {
        entityType: 'artist',
        linkType: 'concertmaster',
    },
    'Compiled By': {
        entityType: 'artist',
        linkType: 'compiler',
    },
    'DJ Mix': {
        entityType: 'artist',
        linkType: 'DJ-mixer',
    },
    Remix: {
        entityType: 'artist',
        linkType: 'remixer',
    },
    'contains samples by': {
        entityType: 'artist',
        linkType: 'contains samples by',
    },
    'Written-By': {
        entityType: 'artist',
        linkType: 'writer',
    },
    'Written By': {
        entityType: 'artist',
        linkType: 'writer',
    },
    'Composed By': {
        entityType: 'artist',
        linkType: 'composer',
    },
    'Words By': {
        entityType: 'artist',
        linkType: 'lyricist',
    },
    'Lyrics By': {
        entityType: 'artist',
        linkType: 'lyricist',
    },
    'Libretto By': {
        entityType: 'artist',
        linkType: 'librettist',
    },
    'Translated By': {
        entityType: 'artist',
        linkType: 'translator',
    },
    'Arranged By': {
        entityType: 'artist',
        linkType: 'arranger',
    },
    'Instrumentation By': {
        entityType: 'artist',
        linkType: 'instruments arranger',
    },
    'Orchestrated By': {
        entityType: 'artist',
        linkType: 'orchestrator',
    },
    'vocals arranger': {
        entityType: 'artist',
        linkType: 'vocals arranger',
    },
    Producer: {
        entityType: 'artist',
        linkType: 'producer',
    },
    'Co-producer': {
        entityType: 'artist',
        linkType: 'producer',
        attributes: ['co'],
    },
    'Executive-Producer': {
        entityType: 'artist',
        linkType: 'producer',
        attributes: ['executive'],
    },
    'Post Production': {
        entityType: 'artist',
        linkType: 'producer',
    },
    Engineer: {
        entityType: 'artist',
        linkType: 'engineer',
    },
    'Audio Engineer': {
        entityType: 'artist',
        linkType: 'audio engineer',
    },
    'Mastered By': {
        entityType: 'artist',
        linkType: 'mastering',
    },
    'Remastered By': {
        entityType: 'artist',
        linkType: 'mastering',
        attributes: ['re'],
    },
    'Lacquer Cut By': {
        entityType: 'artist',
        linkType: 'lacquer cut',
    },
    'sound engineer': {
        entityType: 'artist',
        linkType: 'sound engineer',
    },
    'Mixed By': {
        entityType: 'artist',
        linkType: 'mix',
    },
    'Recorded By': {
        entityType: 'artist',
        linkType: 'recording',
    },
    'Recording Engineer': {
        entityType: 'artist',
        linkType: 'recording',
    },
    'Programmed By': {
        entityType: 'artist',
        linkType: 'programming',
    },
    Editor: {
        entityType: 'artist',
        linkType: 'editor',
    },
    'Edited By': {
        entityType: 'artist',
        linkType: 'editor',
    },
    'balance engineer': {
        entityType: 'artist',
        linkType: 'engineer',
    },
    'copyrighted by': {
        entityType: 'artist',
        linkType: 'copyright',
    },
    'phonographic copyright by': {
        entityType: 'artist',
        linkType: 'phonographic copyright',
    },
    Legal: {
        entityType: 'artist',
        linkType: 'legal representation',
    },
    Booking: {
        entityType: 'artist',
        linkType: 'booking',
    },
    'Art Direction': {
        entityType: 'artist',
        linkType: 'art direction',
    },
    Artwork: {
        entityType: 'artist',
        linkType: 'artwork',
    },
    'Artwork By': {
        entityType: 'artist',
        linkType: 'artwork',
    },
    Cover: {
        entityType: 'artist',
        linkType: 'artwork',
    },
    Design: {
        entityType: 'artist',
        linkType: 'design',
    },
    'Graphic Design': {
        entityType: 'artist',
        linkType: 'graphic design',
    },
    Illustration: {
        entityType: 'artist',
        linkType: 'illustration',
    },
    'Booklet Editor': {
        entityType: 'artist',
        linkType: 'booklet editor',
    },
    Photography: {
        entityType: 'artist',
        linkType: 'photography',
    },
    'Photography By': {
        entityType: 'artist',
        linkType: 'photography',
    },
    Technician: {
        entityType: 'artist',
        linkType: 'instruments technician',
    },
    publisher: {
        entityType: 'artist',
        linkType: 'published',
    },
    'Liner Notes': {
        entityType: 'artist',
        linkType: 'liner notes',
    },
    'A&R': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Advisor: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Concept By': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Contractor: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Coordinator: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Management: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Musical Assistance': {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Tour Manager': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Other: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Public Relations': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Promotion: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Crew: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Supervised By': {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Director Of Photography': {
        entityType: 'artist',
        linkType: 'photography',
        attributes: [{ _type: 'task', value: 'director of photography' }],
    }
};

function doNext(fn, ms = 80) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const response = fn();
                if (response && typeof response.then === 'function') {
                    response.then(resolve).catch(e => reject(e));
                } else {
                    resolve();
                }
            } catch (e) {
                reject(e);
            }
        }, ms);
    });
}

function setNativeValue(element, value) {
    if (typeof element === 'string') {
        element = $(element).get(0);
    }
    let lastValue = element.value;
    element.value = value;
    let event = new Event('input', { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

function selectValue(element, value) {
    if (typeof element === 'string') {
        element = $(element).get(0);
    }
    let lastValue = element.value;
    element.value = value;
    let event = new Event('change', { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

function makeKeyDownEvent(keyCode) {
    return new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, keyCode: 13,
    });
}

function makeClickEvent(element) {
    const clickEvent = new PointerEvent('click', {
        pointerType: 'mouse',
        type: 'click',
        isTrusted: true,
        view: unsafeWindow,
        bubbles: true, // You can set this to true to make the event bubble up the DOM tree
        cancelable: true, // You can set this to true to make the event cancelable
    });
    element.dispatchEvent(clickEvent);
}

const INSTRUMENTS = {
    Afoxé: null,
    Agogô: null,
    Ashiko: null,
    Atabal: null,
    Bapang: null,
    'Clarinet': 'clarinet',
    'Percussion': 'percussion',
    'Congas': 'conga drum',
    'Bongos': 'bongo drum',
    'Tambourine': 'tambourine',
    'Cuica': 'cuíca',
    'Guiro': 'güiro',
    'Güiro': 'güiro',
    'Udu': 'udu',
    'Laúd': 'laúd',
    'Laud': 'laúd',
    'Mbira': 'mbira',
    'Slide Guitar': 'slide guitar',
    'Acoustic Guitar': 'acoustic guitar',
    'Double Bass': 'double bass',
    'Goblet Drum': 'goblet drum',
    'Bongos': 'bongo drum',
    'Maracas': 'maracas',

    'Electronics': 'electronics',
    'Electronic': 'electronics',
    'Synth Bass': 'bass synthesizer',
    'Vocoder': 'vocoder',
    'Xylophone': 'xylophone',
    'Bells': 'bells',
    'Chimes': 'wind chimes',
    'Glockenspiel': 'glockenspiel',
    'Shakers': 'shaker',
    'Shaker': 'shaker',
    'Cowbell': 'cowbell',
    'Claves': 'claves',
    'Timbales': 'timbales',

    'Baritone Guitar': 'baritone guitar',
    'Synth': 'synthesizer',
    'Synthesizer': 'synthesizer',
    'Synths': 'synthesizer',
    'Keyboards': 'keyboard',
    'Keyboard': 'keyboard',
    'Organ': 'organ',
    'Harmonium': 'harmonium',
    'Piano': 'piano',
    'Electric Piano': 'electric piano',
    'Harpsichord': 'harpsichord',
    'Celesta': 'celesta',
    'Strings': 'string instruments',

    'Flute': 'flute',
    'Saxophone': 'saxophone',
    'Vibraphone': 'vibraphone',
    'Trumpet': 'trumpet',
    'Trombone': 'trombone',
    'Violin': 'violin',
    'Cello': 'cello',
    'Viola': 'viola',
    'Harp': 'harp',
    'Banjo': 'banjo',
    'Mandolin': 'mandolin',
    'Ukulele': 'ukulele',
    'Harmonica': 'harmonica',
    'Accordion': 'accordion',
    'Oboe': 'oboe',
    'Bassoon': 'bassoon',
    'Tuba': 'tuba',
    'French Horn': 'French horn',
    'Xylophone': 'xylophone',
    'Marimba': 'marimba',
    'Melodica': 'melodica',
    'Sitar': 'sitar',
    'Oud': 'oud',
    'Kora': 'kora',
    'Tabla': 'tabla',
    'Didgeridoo': 'didgeridoo',
    'Theremin': 'theremin',
    'Flugelhorn': 'flugelhorn',
    'Cornet': 'cornet',
    'Alto Saxophone': 'alto saxophone',
    'Tenor Saxophone': 'tenor saxophone',
    'Soprano Saxophone': 'soprano saxophone',
    'Baritone Saxophone': 'baritone saxophone',
    'Bass Clarinet': 'bass clarinet',
    'Bass Flute': 'bass flute',
    'Piccolo': 'piccolo',
    'Bass Drum': null,
    Bata: null,
    'Bell Tree': null,
    Bells: 'Bell',
    Bendir: null,
    Bodhrán: null,
    'Body Percussion': null,
    Bombo: null,
    Bones: null,
    Bongos: null,
    Buhay: null,
    Buk: null,
    Cabasa: null,
    Caixa: null,
    'Caja Vallenata': null,
    Cajón: null,
    Calabash: null,
    Castanets: null,
    Caxixi: null,
    "Chak'chas": null,
    Chinchín: null,
    Ching: null,
    Claves: null,
    Congas: null,
    Cowbell: null,
    Cymbal: null,
    Daf: null,
    Davul: null,
    Dhol: null,
    Dholak: null,
    Djembe: null,
    Doira: null,
    Doli: null,
    Drum: 'drum set',
    'Drum Programming': null,
    Drums: 'drum set',
    Dunun: null,
    'Electronic Drums': null,
    'Finger Cymbals': null,
    'Finger Snaps': null,
    'Frame Drum': null,
    'Friction Drum': null,
    Frottoir: null,
    Ganzá: null,
    Ghatam: null,
    Ghungroo: null,
    Gong: null,
    Guacharaca: null,
    Handbell: null,
    Handclaps: null,
    'Hang Drum': null,
    Hihat: null,
    Hosho: null,
    Hyoshigi: null,
    Idiophone: null,
    Jaggo: null,
    Janggu: null,
    Jing: null,
    "K'kwaengwari": null,
    Ka: null,
    'Kagura Suzu': null,
    Kanjira: null,
    Karkabas: null,
    Khartal: null,
    Khurdak: null,
    Kynggari: null,
    Lagerphone: null,
    "Lion's Roar": null,
    Madal: null,
    Mallets: null,
    Maracas: null,
    'Monkey stick': null,
    Mridangam: null,
    Pakhavaj: null,
    Pandeiro: null,
    Percussion: null,
    Rainstick: null,
    Ratchet: null,
    Rattle: null,
    'Reco-reco': null,
    Repinique: null,
    Rototoms: null,
    Scraper: null,
    Shaker: null,
    Shakubyoshi: null,
    Shekere: null,
    Shuitar: null,
    'Singing Bowls': null,
    Skratjie: null,
    Slapstick: null,
    'Slit Drum': null,
    Snare: null,
    Spoons: null,
    'Stomp Box': null,
    Surdo: null,
    Surigane: null,
    Tabla: null,
    Taiko: null,
    'Talking Drum': null,
    'Tam-tam': null,
    Tambora: null,
    Tamboril: null,
    Tamborim: null,
    Tambourine: null,
    'Tan-Tan': null,
    'Tap Dance': null,
    'Tar (Drum)': null,
    'Temple Bells': null,
    'Temple Block': null,
    Thavil: null,
    Timbales: null,
    Timpani: null,
    'Tom Tom': null,
    Triangle: null,
    Tüngür: null,
    Udu: null,
    Vibraslap: null,
    Washboard: null,
    Waterphone: null,
    'Wood Block': null,
    Zabumba: null,
    Amadinda: null,
    Angklung: null,
    Balafon: null,
    Boomwhacker: null,
    Carillon: null,
    Celesta: null,
    Chimes: null,
    Crotales: null,
    Glockenspiel: null,
    Guitaret: null,
    Kalimba: null,
    Lamellophone: null,
    Marimba: null,
    Marimbula: null,
    Metallophone: null,
    'Musical Box': null,
    Prempensua: null,
    Slagbordun: null,
    'Steel Drums': null,
    'Thumb Piano': null,
    Tubaphone: null,
    'Tubular Bells': null,
    Tun: null,
    Txalaparta: null,
    Vibraphone: null,
    Xylophone: null,
    'Baby Grand Piano': null,
    Chamberlin: null,
    Claviorgan: null,
    'Concert Grand Piano': null,
    Dulcitone: null,
    'Electric Harmonium': null,
    'Electric Harpsichord': null,
    'Electric Organ': null,
    Fortepiano: null,
    'Grand Piano': null,
    Harmonium: null,
    Harpsichord: null,
    Keyboards: 'Keyboard',
    Mellotron: null,
    Melodica: null,
    Omnichord: null,
    'Ondes Martenot': null,
    Organ: null,
    'Parlour Grand Piano': null,
    Pedalboard: null,
    Piano: null,
    'Player Piano': null,
    Regal: null,
    Stylophone: null,
    Synth: 'Synthesizer',
    Synthesizer: null,
    'Tangent Piano': null,
    'Toy Piano': null,
    'Upright Piano': null,
    Virginal: null,
    '12-String Acoustic Guitar': null,
    '12-String Bass': null,
    '5-String Banjo': null,
    '6-String Banjo': null,
    '6-String Bass': null,
    'Acoustic Bass': null,
    'Arco Bass': null,
    Arpa: null,
    Autoharp: null,
    Baglama: null,
    'Bajo Quinto': null,
    'Bajo Sexto': null,
    Balalaika: null,
    Bandola: null,
    Bandura: null,
    Bandurria: null,
    Banhu: null,
    Banjo: null,
    Banjolin: null,
    'Baroque Guitar': null,
    Baryton: null,
    'Bass Guitar': null,
    Berimbau: null,
    Bhapang: null,
    Biwa: null,
    'Blaster Beam': null,
    Bolon: null,
    Bouzouki: null,
    'Bulbul Tarang': null,
    Byzaanchi: null,
    Cavaquinho: null,
    Cello: null,
    'Cello Banjo': null,
    Changi: null,
    Chanzy: null,
    'Chapman Stick': null,
    Charango: null,
    Chitarrone: null,
    Chonguri: null,
    Chuniri: null,
    Cimbalom: null,
    Citole: null,
    Cittern: null,
    Clàrsach: null,
    'Classical Guitar': null,
    Clavichord: null,
    Clavinet: null,
    Cobza: null,
    Contrabass: null,
    Cuatro: null,
    Cümbüş: null,
    Cura: null,
    Deaejeng: null,
    'Diddley Bow': null,
    Dilruba: null,
    Dobro: null,
    Dojo: null,
    Dombra: null,
    Domra: null,
    Doshpuluur: null,
    Dulcimer: null,
    Dutar: null,
    'Đàn bầu': null,
    Ektare: null,
    'Electric Bass': null,
    'Electric Guitar': null,
    'Electric Upright Bass': null,
    'Electric Violin': null,
    'Epinette des Vosges': null,
    Erhu: null,
    Esraj: null,
    Fiddle: null,
    'Flamenco Guitar': null,
    'Fretless Bass': null,
    'Fretless Guitar': null,
    Gadulka: null,
    Gaohu: null,
    Gayageum: null,
    Geomungo: null,
    Giga: null,
    Gittern: null,
    Gottuvâdyam: null,
    Guimbri: null,
    Guitalele: null,
    Guitar: null,
    'Guitar Banjo': null,
    'Guitar Synthesizer': null,
    Guitarrón: null,
    GuitarViol: null,
    Guqin: null,
    Gusli: null,
    Guzheng: null,
    Haegum: null,
    Halldorophone: null,
    Hardingfele: null,
    Harp: null,
    'Harp Guitar': null,
    Hummel: null,
    Huqin: null,
    'Hurdy Gurdy': null,
    Igil: null,
    Jarana: null,
    Jinghu: null,
    Jouhikko: null,
    Kabosy: null,
    Kamancha: null,
    Kanklės: null,
    Kantele: null,
    Kanun: null,
    Kemenche: null,
    Kirar: null,
    Kobyz: null,
    Kokyu: null,
    Kora: null,
    Koto: null,
    Krar: null,
    Langeleik: null,
    Laouto: null,
    'Lap Steel Guitar': null,
    Laúd: null,
    Lavta: null,
    'Lead Guitar': null,
    Lira: null,
    'Lira da Braccio': null,
    Lirone: null,
    Liuqin: null,
    Lute: null,
    Lyre: null,
    Mandobass: null,
    Mandocello: null,
    Mandoguitar: null,
    Mandola: null,
    Mandolin: null,
    'Mandolin Banjo': null,
    Mandolincello: null,
    Marxophone: null,
    Masinko: null,
    Monochord: null,
    Morinhoor: null,
    'Mountain Dulcimer': null,
    'Musical Bow': null,
    Ngoni: null,
    Nyckelharpa: null,
    'Open-Back Banjo': null,
    Oud: null,
    Outi: null,
    Panduri: null,
    'Pedal Steel Guitar': null,
    'Piccolo Banjo': null,
    Pipa: null,
    'Plectrum Banjo': null,
    'Portuguese Guitar': null,
    Psalmodicon: null,
    Psaltery: null,
    Rabab: null,
    Rabeca: null,
    Rebab: null,
    Rebec: null,
    Reikin: null,
    'Requinto Guitar': null,
    'Resonator Banjo': null,
    'Resonator Guitar': null,
    'Rhythm Guitar': null,
    Ronroco: null,
    Ruan: null,
    Sanshin: null,
    Santoor: null,
    Sanxian: null,
    Sarangi: null,
    Sarod: null,
    'Selmer-Maccaferri Guitar': null,
    'Semi-Acoustic Guitar': null,
    Seperewa: null,
    'Shahi Baaja': null,
    Shamisen: null,
    Sintir: null,
    Sitar: null,
    Spinet: null,
    'Steel Guitar': null,
    Strings: null,
    'Stroh Violin': null,
    Strumstick: null,
    Surbahar: null,
    'Svara Mandala': null,
    Swarmandel: null,
    Sympitar: null,
    SynthAxe: null,
    Taishōgoto: null,
    Talharpa: null,
    Tambura: null,
    Tamburitza: null,
    Tapboard: null,
    'Tar (lute)': null,
    'Tenor Banjo': null,
    'Tenor Guitar': null,
    Theorbo: null,
    Timple: null,
    Tiple: null,
    Tipple: null,
    Tonkori: null,
    Tres: null,
    'Tromba Marina': null,
    'Twelve-String Guitar': null,
    Tzouras: null,
    Ukulele: null,
    'Ukulele Banjo': null,
    Ütőgardon: null,
    Valiha: null,
    Veena: null,
    Vielle: null,
    Vihuela: null,
    Viol: null,
    Viola: null,
    'Viola Caipira': null,
    "Viola d'Amore": null,
    'Viola da Gamba': null,
    'Viola de Cocho': null,
    'Viola Kontra': null,
    'Viola Nordestina': null,
    Violin: null,
    'Violino Piccolo': null,
    Violoncello: null,
    Violone: null,
    'Washtub Bass': null,
    Xalam: null,
    "Yang T'Chin": null,
    Yanggeum: null,
    Zither: null,
    Zongora: null,
    Accordion: null,
    Algoza: null,
    Alphorn: null,
    'Alto Clarinet': null,
    'Alto Flute': null,
    'Alto Horn': null,
    'Alto Recorder': null,
    Apito: null,
    Bagpipes: null,
    Bandoneon: null,
    Bansuri: null,
    'Baritone Horn': null,
    'Barrel Organ': null,
    'Bass Harmonica': null,
    'Bass Saxophone': null,
    'Bass Trombone': null,
    'Bass Trumpet': null,
    'Bass Tuba': null,
    'Basset Horn': null,
    Bassoon: null,
    Bawu: null,
    Bayan: null,
    Bellowphone: null,
    Beresta: null,
    'Blues Harp': null,
    'Bolivian Flute': null,
    Bombarde: null,
    Brass: null,
    'Brass Bass': null,
    Bucium: null,
    Bugle: null,
    Chalumeau: null,
    Chanter: null,
    Charamel: null,
    Chirimia: null,
    Clarinet: null,
    Clarion: null,
    Claviola: null,
    Comb: null,
    'Concert Flute': null,
    Concertina: null,
    Conch: null,
    'Contra-Alto Clarinet': null,
    'Contrabass Clarinet': null,
    'Contrabass Saxophone': null,
    Contrabassoon: null,
    'Cor Anglais': null,
    Cornet: null,
    Cornett: null,
    Cromorne: null,
    Crumhorn: null,
    Daegeum: null,
    Danso: null,
    Didgeridoo: null,
    'Dili Tuiduk': null,
    Dizi: null,
    Drone: null,
    Duduk: null,
    Dulcian: null,
    Dulzaina: null,
    'Electronic Valve Instrument': null,
    'Electronic Wind Instrument': null,
    'English Horn': null,
    Euphonium: null,
    Fife: null,
    Flageolet: null,
    Flugabone: null,
    Flugelhorn: null,
    Fluier: null,
    Flumpet: null,
    Flute: null,
    "Flute D'Amour": null,
    Friscaletto: null,
    Fujara: null,
    Galoubet: null,
    Gemshorn: null,
    Gudastviri: null,
    Harmet: null,
    Harmonica: null,
    Heckelphone: null,
    Helicon: null,
    Hichiriki: null,
    'Highland Pipes': null,
    Horagai: null,
    Horn: null,
    Horns: null,
    Hotchiku: null,
    'Hunting Horn': null,
    Jug: null,
    Kagurabue: null,
    Kaval: null,
    Kazoo: null,
    Khene: null,
    Kortholt: null,
    Launeddas: null,
    Limbe: null,
    Liru: null,
    'Low Whistle': null,
    Lur: null,
    Lyricon: null,
    Mänkeri: null,
    Mellophone: null,
    Melodeon: null,
    Mey: null,
    Mizmar: null,
    Mizwad: null,
    Moceño: null,
    'Mouth Organ': null,
    Murli: null,
    Musette: null,
    Nadaswaram: null,
    Ney: null,
    'Northumbrian Pipes': null,
    'Nose Flute': null,
    Oboe: null,
    "Oboe d'Amore": null,
    'Oboe Da Caccia': null,
    Ocarina: null,
    Ophicleide: null,
    'Overtone Flute': null,
    Panpipes: null,
    'Piano Accordion': null,
    'Piccolo Flute': null,
    'Piccolo Trumpet': null,
    Pipe: null,
    Piri: null,
    Pito: null,
    Pixiephone: null,
    Quena: null,
    Quenacho: null,
    Quray: null,
    Rauschpfeife: null,
    Recorder: null,
    Reeds: null,
    Rhaita: null,
    Rondador: null,
    Rozhok: null,
    Ryuteki: null,
    Sackbut: null,
    Salamuri: null,
    Sampona: null,
    Sarrusophone: null,
    Saxello: null,
    Saxhorn: null,
    Saxophone: null,
    Schwyzerörgeli: null,
    Serpent: null,
    Shakuhachi: null,
    Shanai: null,
    Shawm: null,
    Shenai: null,
    Sheng: null,
    Shinobue: null,
    Sho: null,
    'Shruti Box': null,
    'Slide Whistle': null,
    Smallpipes: null,
    Sodina: null,
    Sopilka: null,
    'Sopranino Saxophone': null,
    'Soprano Clarinet': null,
    'Soprano Cornet': null,
    'Soprano Flute': null,
    'Soprano Trombone': null,
    Souna: null,
    Sousaphone: null,
    'Subcontrabass Saxophone': null,
    Suling: null,
    Suona: null,
    Taepyungso: null,
    Tárogató: null,
    'Tenor Horn': null,
    'Tenor Trombone': null,
    'Ti-tse': null,
    'Tin Whistle': null,
    Tonette: null,
    Trombone: null,
    Trumpet: null,
    Tuba: null,
    Txirula: null,
    Txistu: null,
    'Uilleann Pipes': null,
    'Valve Trombone': null,
    'Valve Trumpet': null,
    'Wagner Tuba': null,
    Whistle: null,
    'Whistling Water Jar': null,
    Wind: null,
    Woodwind: null,
    Xiao: null,
    Yorgaphone: null,
    Zhaleika: null,
    Zukra: null,
    Zurna: null,
    'Automatic Orchestra': null,
    Computer: null,
    'Drum Machine': null,
    Effects: null,
    Electronics: null,
    Groovebox: null,
    Loops: null,
    'MIDI Controller': null,
    Noises: null,
    Sampler: null,
    Scratches: null,
    Sequencer: null,
    'Software Instrument': null,
    Talkbox: null,
    Tannerin: null,
    Tape: null,
    Theremin: null,
    Turntables: null,
    Vocoder: null,
    'Accompanied By': null,
    'Audio Generator': null,
    'Backing Band': null,
    Band: null,
    Bass: null,
    'Brass Band': null,
    Bullroarer: null,
    'Concert Band': null,
    'E-Bow': null,
    Ensemble: null,
    Gamelan: null,
    'Glass Harmonica': null,
    Guest: null,
    Homus: null,
    Instruments: null,
    "Jew's Harp": null,
    Mbira: null,
    Morchang: null,
    Musician: null,
    Orchestra: null,
    Performer: null,
    'Rhythm Section': null,
    Saw: null,
    Siren: null,
    Soloist: null,
    Sounds: null,
    Toy: null,
    Trautonium: null,
    'Wind Chimes': null,
    'Wobble Board': null,
};

const WORK_ONLY_ARTIST_RELS = [
    'writer',
    'composer',
    'lyricist',
    'librettist',
    'revised by',
    'translator',
    'reconstructed by',
    // 'arranger',
    // 'instruments arranger',
    'orchestrator',
    // 'vocals arranger',
    'previously attributed to',
    'miscellaneous support',
    'dedicated to',
    'premiered by',
    'was commissioned by',
    'publisher',
    'inspired the name of',
];

const DISCOGS_LOGO_URL = 'https://volkerzell.de/favicons/discogs.png';