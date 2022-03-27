// render headlinks
let getHeader = (req, res) => {
    return res.render("partials/header.ejs");
};

module.exports = {
    getHeader: getHeader
};
