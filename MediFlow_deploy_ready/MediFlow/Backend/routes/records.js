const express = require("express");
const multer = require("multer");
const path = require("path");

const router =
    express.Router();


// ========================================
// FILE UPLOAD CONFIGURATION
// ========================================

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                cb(
                    null,
                    path.join(
                        __dirname,
                        "../../uploads"
                    )
                );

            },


        filename:
            function (
                req,
                file,
                cb
            ) {

                const uniqueName =
                    Date.now() +
                    "-" +
                    file.originalname
                        .replace(
                            /\s+/g,
                            "_"
                        );


                cb(
                    null,
                    uniqueName
                );

            }

    });


const upload =
    multer({
        storage:
            storage
    });



// ========================================
// TEMPORARY RECORD STORAGE
// ========================================

let records = [];



// ========================================
// UPLOAD MEDICAL RECORD
// ========================================

router.post(
    "/upload",
    upload.single(
        "medicalRecord"
    ),
    function (
        req,
        res
    ) {

        try {

            if (!req.file) {

                return res.status(400).json({

                    message:
                        "Please upload a medical record."

                });

            }


            const newRecord = {

                id:
                    records.length + 1,

                patientName:
                    req.body.patientName,

                patientAge:
                    req.body.patientAge,

                sourceLanguage:
                    req.body.sourceLanguage,

                recordDate:
                    req.body.recordDate,

                fileName:
                    req.file.filename,

                originalFileName:
                    req.file.originalname,

                recordType:
                    req.file.mimetype

            };


            records.push(
                newRecord
            );


            res.status(201).json({

                message:
                    "Medical record uploaded successfully.",

                record:
                    newRecord

            });

        }


        catch (error) {

            console.error(
                "Upload error:",
                error
            );

            res.status(500).json({

                message:
                    "Could not upload the medical record."

            });

        }

    }
);



// ========================================
// GET ALL RECORDS
// ========================================

router.get(
    "/",
    function (
        req,
        res
    ) {

        res.json(
            records
        );

    }
);


module.exports =
    router;