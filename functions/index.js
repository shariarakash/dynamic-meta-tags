const functions = require('firebase-functions');
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

const app = express();

// Create a temporary directory for storing generated images
const IMAGES_DIR = path.join(__dirname, 'temp-images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}

const accessToken = "Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImV4elpnNGx1UnZpV0M0N3kiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2l1YXplZ3NvcnZvcGRma3ZleWN1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0ODI3ODg2OS1iMWVmLTQ2ZGYtOWJkYy00NGE1OWE5MTNjZTMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzM1Nzk2MDUxLCJpYXQiOjE3MzUxOTEyNTEsImVtYWlsIjoiIiwicGhvbmUiOiI4ODAxNjAzNTI5MzAwIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoicGhvbmUiLCJwcm92aWRlcnMiOlsicGhvbmUiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInByb3ZpZGVyIjoicGhvbmUiLCJzdWIiOiI0ODI3ODg2OS1iMWVmLTQ2ZGYtOWJkYy00NGE1OWE5MTNjZTMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTcyNzk0MTExNn1dLCJzZXNzaW9uX2lkIjoiMzI5NDllYjEtNzc0Yi00NTZkLTlkODQtYzMxZDcwYjgzZjczIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.70eK0RV62hw8ud5OomxT895RB1KoDBiSJbO5rMCGmnI"

let header = {
    "Content-Type":
        "application/json",
    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQyNDkxMTc4LCJleHAiOjE5NTgwNjcxNzh9.Oz-apWdllp2W8JlB4oGG0mF5QJnrN4vDOzk6BkJlSH4",
    Authorization: accessToken,
}


// Dynamic meta tag replacement
app.get("/single_job_description", async (req, res) => {
  const filePath = path.join(__dirname, "build", "index.html");

  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      return res.status(500).send("An error occurred.");
      
    }

    console.log(req.query.id);

    const requestData = {
        job_id_data: req.query.id,
    }

    const responses = await getSingleJobDescriptions(requestData);

    const jobData = responses?.data[0];

    const neededPart = {
        logo: jobData.company_logo,
        title: jobData.job_title,
        companyName: jobData.company_name,
        salaryRange: jobData.salary_range,
        status: jobData.employment_status,
        location: jobData.job_locations,
        deadline: jobData.application_deadline
    }

    console.log("needed part", neededPart);

       // Get user agent
       const userAgent = req.get('user-agent')?.toLowerCase();
       const isCrawler = userAgent?.includes('whatsapp') || 
                        userAgent?.includes('facebook') || 
                        userAgent?.includes('twitter') ||
                        userAgent?.includes('linkedin') ||
                        userAgent?.includes('bot');

       let imageUrl;
       
       if (isCrawler) {
           // Generate the image only for crawler requests
           const fileName = await generateAndSaveImage(neededPart, requestData.job_id_data, userAgent);
           const host = req.get('host');
           const protocol = req.protocol;
           imageUrl = `${protocol}://${host}/generated-images/${fileName}`;
       } else {
           // For regular users, use a default image or any static image
           imageUrl = 'your-default-image-url.png'; // Replace with your default image URL
       }


    // Replace placeholders with dynamic values
    const dynamicMetaTags = {
      "__OG_TITLE__": "Dynamic Title for " + neededPart.title,
      "__OG_DESCRIPTION__": "This is a dynamic description for " + neededPart.companyName,
    //   "__OG_IMAGE__": `https://example.com/images${req.path}.png`,
      "__OG_IMAGE__": imageUrl,
    };

    let updatedHtml = data;
    Object.keys(dynamicMetaTags).forEach((key) => {
      updatedHtml = updatedHtml.replace(new RegExp(key, "g"), dynamicMetaTags[key]);
    });

    res.send(updatedHtml);
  });
});

app.get('/generated-images/:filename', (req, res) => {
    const filePath = path.join(IMAGES_DIR, req.params.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Image not found');
    }

    // Get user agent
    const userAgent = req.get('user-agent')?.toLowerCase();
    const isCrawler = userAgent?.includes('whatsapp') || 
                     userAgent?.includes('facebook') || 
                     userAgent?.includes('bot');

    // Send file and handle cleanup
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error sending file:', err);
            return;
        }

        // For crawlers, delay deletion
        const deleteDelay = isCrawler ? 5000 : 0;
        
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                } else {
                    console.log(`Deleted ${filePath}`);
                }
            });
        }, deleteDelay);
    });
});

const getSingleJobDescriptions = async (requestData) => {
    try {
      const url =
        "https://iuazegsorvopdfkveycu.supabase.co/rest/v1/rpc/get_single_job_description_guest_new";
      const accessTokenp = accessToken;
      const response = await postRequest(url, requestData, accessTokenp);
      return response;
    } catch (error) {
      console.error(error);
    }
  };

  const postRequest = async (url, body, accessToken) => {
    header = {
        ...header,
        Authorization: accessToken
    }
    
    const response = await axios.post(url, body, {headers: header});
    return response;
}

const generateAndSaveImage = async (neededPart, jobId, crawlerType) => {
    try {
        // Set canvas size based on crawlerType
        const isFacebook = crawlerType.includes("facebook");
        const canvasWidth = isFacebook ? 1200 : 1200;
        const canvasHeight = isFacebook ? 628 : 630;

        // Create larger canvas for better quality
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");

        // Set white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw hexagonal pattern background
        const drawHexagonalPattern = (ctx) => {
            const hexSize = 40;
            const hexWidth = hexSize * 2;
            const hexHeight = Math.sqrt(3) * hexSize;
            ctx.strokeStyle = "#f0f0f0";
            ctx.lineWidth = 1;

            for (let row = 0; row < canvas.height / hexHeight + 1; row++) {
                for (let col = 0; col < canvas.width / (hexWidth * 0.75) + 1; col++) {
                    const x = col * hexWidth * 0.75;
                    const y = row * hexHeight + (col % 2) * hexHeight * 0.5;
                    
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = i * Math.PI / 3;
                        const xPos = x + hexSize * Math.cos(angle);
                        const yPos = y + hexSize * Math.sin(angle);
                        if (i === 0) ctx.moveTo(xPos, yPos);
                        else ctx.lineTo(xPos, yPos);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        };

        // Draw background pattern
        drawHexagonalPattern(ctx);

        // Load and draw company logo
        const logo = await loadImage(neededPart.logo);
        const logoSize = 150;
        const padding = 40;
        ctx.drawImage(logo, padding, padding, logoSize, logoSize);

        // Set up text configurations
        const startX = padding;
        let startY =  padding + 60;

        // Draw job title (large and bold)
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#000000";
        ctx.fillText(neededPart.title, startX + logoSize + 10, startY);
        startY += 70;

        // Draw company name (gray and smaller)
        ctx.font = "36px Arial";
        ctx.fillStyle = "#666666";
        ctx.fillText(`${neededPart.companyName}`, startX + logoSize + 10, startY);
        startY += 90;

        // Create salary and type boxes
        const drawBox = (text, x, y, width) => {
            const height = 80;
            const radius = 10;
            
            // Draw rounded rectangle
            ctx.fillStyle = "#f5f5f5";
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();

            // Add text
            ctx.font = "30px Arial";
            ctx.fillStyle = "#000000";
            ctx.fillText(text, x + 20, y + 45);
        };

        // Draw salary and type boxes
        drawBox(`Salary: ${neededPart.salaryRange}`, startX, startY, 500);
        drawBox(`Type: ${neededPart.status}`, startX + 550, startY, 300);
        startY += 120;

        // Draw location box
        drawBox(`Location: ${neededPart.location}`, startX, startY, 900);
        startY += 120;

        // Draw deadline bar
        ctx.fillStyle = "#4CAF50"; // Green color
        ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
        ctx.font = "bold 36px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(`Deadline: ${neededPart.deadline}`, canvas.width / 2, canvas.height - 40);

        // Save the image
        const fileName = `job-${jobId}.png`;
        const filePath = path.join(IMAGES_DIR, fileName);
        
        const out = fs.createWriteStream(filePath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        return new Promise((resolve, reject) => {
            out.on('finish', () => {
                resolve(fileName);
            });
            out.on('error', reject);
        });
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

// Serve static files from the CRA build directory
app.use(express.static(path.join(__dirname, "../build")));

exports.app = functions.https.onRequest(app);