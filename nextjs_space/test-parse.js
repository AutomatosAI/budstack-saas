function C(e, t) {
    let s = t.split('\n');
    for (let a = 0; a < s.length; a++) {
        if (s[a]) e.push({ text: s[a] });
    }
}

function $(e) {
    let t = [], s = e;
    for (; s.length > 0;) {
        let a = s.length, i = "", o = 0, n = "", l = "";
        let d = s.indexOf("**");
        if (d >= 0 && d < a) {
            let r = s.indexOf("**", d + 2);
            if (r >= 0) {
                a = d;
                i = "bold";
                o = r + 2 - d;
                n = s.slice(d + 2, r);
            }
        }
        
        let p = (a > 0 && C(t, s.slice(0, a)), !i);
        console.log("p=" + p, "a=" + a, "i=" + i);
        if (p) {
            break;
        }
        s = s.slice(a + o);
    }
    return t;
}
console.log($("Hello World"));
console.log($("**Hello** World"));
