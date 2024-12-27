import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import Joi from 'joi'; // Add Joi for request validation

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Use Morgan for logs
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS configuration
app.use(cors({
    origin: ['https://wowdrone.webflow.io', 'http://localhost:3000', 'https://server-pre-deploy.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Register route
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, industry, country, phone } = req.body;

        // Debug logging
        console.log('Registration attempt:', {
            endpoint: req.path,
            method: req.method,
            headers: req.headers,
            body: { ...req.body, password: '[REDACTED]' }
        });

        // Validate request body
        const schema = Joi.object({
            name: Joi.string().required(),
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
            industry: Joi.string().optional(),
            country: Joi.string().optional(),
            phone: Joi.string().optional()
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        // Supabase authentication
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email.toLowerCase().trim(),
            password,
            options: {
                data: { name, industry, country, phone }
            }
        });

        if (authError) {
            console.error('Supabase Auth Error:', {
                code: authError.code,
                message: authError.message,
                details: authError.details
            });

            return res.status(400).json({
                success: false,
                message: authError.message,
                code: authError.code
            });
        }

        // Database insertion
        const { error: dbError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id,
                name,
                email: email.toLowerCase().trim(),
                industry,
                country,
                phone,
                created_at: new Date().toISOString()
            }]);

        if (dbError) {
            console.error('Database Error:', {
                code: dbError.code,
                message: dbError.message,
                details: dbError.details
            });

            // Cleanup on database error
            await supabase.auth.admin.deleteUser(authData.user.id);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to create user profile',
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }

        res.status(200).json({
            success: true,
            message: `User ${name} successfully registered!`,
            userId: authData.user.id
        });

    } catch (error) {
        console.error('Registration Error:', {
            message: error.message,
            stack: error.stack,
            type: error.constructor.name
        });

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
