// render headlinks
let getHeadLinks = (req, res) => {
    return res.render("partials/headLinks.ejs");
};

module.exports = {
    getHeadLinks: getHeadLinks
};