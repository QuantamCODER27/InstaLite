const router = require("express").Router();
const controller = require("../controllers/posts.controller");
const likes = require("../controllers/likes.controller");
const validateId = require("../middleware/validate-id");

router.param("id", validateId("Post"));
router.param("userId", validateId("User"));
router.post("/", controller.create);
router.get("/", controller.list);
router.get("/:id/likes", likes.list);
router.post("/:id/likes", likes.create);
router.delete("/:id/likes/:userId", likes.remove);
router.get("/:id", controller.getOne);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
